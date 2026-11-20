// The room as both screens see it, kept outside React so a game keeps running
// while screens re-render.
//
// The host's device is the referee: it holds the game, checks every move,
// runs both clocks and decides how the game ends. After every change it sends
// the guest the whole picture. The guest sends its moves, resignation and draw
// answers, and shows its own moves at once while the host confirms them.

import { other, type Color, type Move } from '../chess/types';
import { findLegal, play } from '../chess/standard';
import { createStore } from '../lib/store';
import type { ModeId } from '../modes';
import { Room, RoomError, type RoomMessage } from '../net/room';
import {
  LAG_CREDIT_MS,
  answerDraw,
  checkFlag,
  forfeit,
  moveIn,
  newMatch,
  offerDraw,
  plyOf,
  resign,
  evictIn,
  rollIn,
  skipIn,
  viewOf,
  type GameView,
  type MatchState,
  DEFAULT_OPTIONS,
  type ModeOptions,
  type Result,
} from './match';
import { sameTime, type TimeControl } from './time';

/** The host's dice (Pot-Hole): whole numbers 0..n-1 from the browser's secure random source. */
function dice(n: number) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

/** How long a player who lost connection has to come back before they forfeit. */
export const GRACE_MS = 30_000;
/** Each try at getting back to the room gives up after this long. */
const REJOIN_TRY_MS = 8_000;

export interface Setup {
  mode: ModeId;
  time: TimeControl;
  options: ModeOptions;
}

export interface RoomScreen {
  status: 'connecting' | 'open' | 'closed' | 'error';
  role: 'host' | 'guest';
  code: string;
  error: string | null;
  /** Shown once, then cleared (for example "Your opponent left the room"). */
  notice: string | null;
  /** The host's current picks. The guest sees them change live. */
  setup: Setup;
  /** Host: a guest is seated and connected. Guest: connected to the host. */
  opponentHere: boolean;
  phase: 'setup' | 'game';
  game: GameView | null;
  /** performance.now() at which `game`'s clock times were right. */
  gameAt: number;
  myColor: Color | null;
  /** Guest: lost the host, trying to get back until this time (performance.now()). */
  reconnecting: number | null;
}

const DEFAULT_SETUP: Setup = { mode: 'standard', time: null, options: DEFAULT_OPTIONS };

const blank: RoomScreen = {
  status: 'closed',
  role: 'host',
  code: '',
  error: null,
  notice: null,
  setup: DEFAULT_SETUP,
  opponentHere: false,
  phase: 'setup',
  game: null,
  gameAt: 0,
  myColor: null,
  reconnecting: null,
};

export const roomStore = createStore<RoomScreen>({ ...blank });
const patch = (p: Partial<RoomScreen>) => roomStore.set((s) => ({ ...s, ...p }));
const now = () => performance.now();

let room: Room | null = null;
/** Bumped whenever a room is left, so late answers from an old room are ignored. */
let generation = 0;

// Host side --------------------------------------------------------------------
let match: MatchState | null = null;
let setup: Setup = DEFAULT_SETUP;
/** The guest lost connection: their seat is held until this time. */
let awayUntil: number | null = null;
let awayTimer: number | undefined;
let flagTimer: number | undefined;
let gamesPlayed = 0;

// Guest side -------------------------------------------------------------------
let token: string | null = null;
/** When the guest's current turn started (their own clock, for the time they report). */
let turnStart = { key: '', at: 0 };

// Both: notices a device that was asleep (a phone app in the background) for
// longer than the grace period. That device was the one away, so it forfeits.
let watchdog: number | undefined;
let lastTick = 0;

function startWatchdog() {
  window.clearInterval(watchdog);
  lastTick = now();
  watchdog = window.setInterval(() => {
    const t = now();
    const slept = t - lastTick > GRACE_MS;
    lastTick = t;
    if (!slept) return;
    const s = roomStore.get();
    if (s.role === 'host') {
      if (match && !match.result) {
        match = forfeit(match, match.hostColor, 'forfeit', t) ?? match;
        publish();
      }
    } else if (s.game && !s.game.result && s.myColor) {
      endLocally({ winner: other(s.myColor), reason: 'forfeit' });
    }
  }, 1000);
}

// ---------------------------------------------------------------- entering and leaving

export async function createRoom() {
  leaveRoom();
  const gen = generation;
  match = null;
  setup = DEFAULT_SETUP;
  gamesPlayed = 0;
  awayUntil = null;
  roomStore.set({ ...blank, status: 'connecting', role: 'host' });
  try {
    const r = await Room.host({
      admit: (t) => (roomStore.get().opponentHere || awayUntil !== null ? (t ? 'rejoin' : 'full') : 'new'),
      onJoin: (_id, rejoin) => guestJoined(rejoin),
      onLeave: (_id, reason) => guestGone(reason),
      onMessage: (_id, msg) => fromGuest(msg),
    });
    if (gen !== generation) return r.close();
    room = r;
    patch({ status: 'open', code: r.code });
    startWatchdog();
  } catch (e) {
    if (gen !== generation) return;
    patch({ status: 'error', error: e instanceof RoomError ? e.message : 'Could not create a room.' });
  }
}

export async function joinRoom(code: string) {
  leaveRoom();
  const gen = generation;
  token = null;
  roomStore.set({ ...blank, status: 'connecting', role: 'guest', code });
  try {
    const r = await Room.join(code, null, guestHandlers());
    if (gen !== generation) return r.close();
    room = r;
    token = r.token;
    patch({ status: 'open', opponentHere: true });
    startWatchdog();
  } catch (e) {
    if (gen !== generation) return;
    patch({ status: 'error', error: e instanceof RoomError ? e.message : 'Could not join the room.' });
  }
}

/** Leaves the room (and with it any game in progress, which the other side then wins). */
export function leaveRoom() {
  generation++;
  window.clearTimeout(awayTimer);
  window.clearTimeout(flagTimer);
  window.clearInterval(watchdog);
  room?.close();
  room = null;
  match = null;
  awayUntil = null;
  roomStore.set({ ...blank });
}

export function clearNotice() {
  if (roomStore.get().notice) patch({ notice: null });
}

/** Is a game going on that leaving would forfeit? */
export function gameInProgress() {
  const s = roomStore.get();
  return s.phase === 'game' && !!s.game && !s.game.result;
}

// ---------------------------------------------------------------- host: room and setup

export function setSetup(p: Partial<Setup>) {
  if (roomStore.get().role !== 'host') return;
  const next = { ...setup, ...p };
  if (next.mode === setup.mode && sameTime(next.time, setup.time) && next.options.potholeDuration === setup.options.potholeDuration) return;
  setup = next;
  publish();
}

/** Starts a game with the current setup. Colors are random. */
export function startGame() {
  const s = roomStore.get();
  if (s.role !== 'host' || !s.opponentHere) return;
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  beginGame((bytes[0] & 1) === 0 ? 'w' : 'b');
}

/** Same mode and time control, colors swapped. Only the host chooses it. */
export function rematch() {
  const s = roomStore.get();
  if (s.role !== 'host' || !s.opponentHere || !match?.result) return;
  beginGame(other(match.hostColor));
}

export function backToSetup() {
  if (roomStore.get().role !== 'host') return;
  if (match && !match.result) return;
  match = null;
  window.clearTimeout(flagTimer);
  patch({ phase: 'setup' });
  publish();
}

function beginGame(hostColor: Color) {
  gamesPlayed++;
  match = newMatch(gamesPlayed, setup.mode, setup.time, hostColor, now(), setup.options);
  patch({ phase: 'game' });
  publish();
}

function guestJoined(rejoin: boolean) {
  window.clearTimeout(awayTimer);
  awayUntil = null;
  patch({ opponentHere: true, notice: rejoin ? 'Your opponent is back.' : null });
  publish();
}

function guestGone(reason: 'left' | 'lost') {
  const t = now();
  patch({ opponentHere: false });
  if (reason === 'left') {
    room?.freeSeat();
    if (match && !match.result) match = forfeit(match, other(match.hostColor), 'left', t) ?? match;
    patch({ notice: 'Your opponent left the room.' });
    publish();
    return;
  }
  // Lost connection: hold the seat for the grace period.
  awayUntil = t + GRACE_MS;
  window.clearTimeout(awayTimer);
  awayTimer = window.setTimeout(graceOver, GRACE_MS);
  publish();
}

function graceOver() {
  if (awayUntil === null) return;
  awayUntil = null;
  room?.freeSeat();
  const t = now();
  if (match && !match.result) {
    // If this device lost the internet itself, it is the one that was disconnected.
    const hostAway = room?.offline ?? false;
    const loser = hostAway ? match.hostColor : other(match.hostColor);
    match = forfeit(match, loser, 'forfeit', t) ?? match;
  }
  patch({ notice: 'Your opponent did not come back.' });
  publish();
}

// ---------------------------------------------------------------- host: the game

function fromGuest(msg: RoomMessage) {
  if (!match) return;
  const guest = other(match.hostColor);
  const t = now();
  let next: MatchState | null = null;
  if (msg.t === 'move' && isMove(msg.move)) {
    const used = typeof msg.used === 'number' && msg.used >= 0 ? msg.used : null;
    next = moveIn(match, guest, msg.move, used ?? Infinity, t, dice);
  } else if (msg.t === 'resign') next = resign(match, guest, t);
  else if (msg.t === 'roll') next = rollIn(match, guest, typeof msg.used === 'number' ? msg.used : Infinity, t, dice);
  else if (msg.t === 'skip') next = skipIn(match, guest, typeof msg.used === 'number' ? msg.used : Infinity, t);
  else if (msg.t === 'evict' && Number.isInteger(msg.sq)) next = evictIn(match, guest, msg.sq as number, typeof msg.used === 'number' ? msg.used : Infinity, t);
  else if (msg.t === 'draw') {
    if (msg.a === 'offer') next = offerDraw(match, guest);
    else next = answerDraw(match, guest, msg.a === 'accept', t);
  }
  if (next) match = next;
  // Sent even when nothing changed, so a guest whose move was refused sees the real position again.
  publish();
}

function isMove(m: unknown): m is Move {
  const v = m as Move;
  return !!v && Number.isInteger(v.from) && Number.isInteger(v.to) && v.from >= 0 && v.from < 64 && v.to >= 0 && v.to < 64 && (v.promo === undefined || ['Q', 'R', 'B', 'N'].includes(v.promo)) && (v.mk === undefined || typeof v.mk === 'boolean') && (v.define === undefined || ['Q', 'R', 'B', 'N'].includes(v.define));
}

/** Sends the current picture to the guest and shows it here. */
function publish() {
  const s = roomStore.get();
  if (s.role !== 'host') return;
  const t = now();
  const away = awayUntil !== null && match ? { color: other(match.hostColor), msLeft: Math.max(0, awayUntil - t) } : null;
  const game = match ? viewOf(match, t, away) : null;
  patch({ setup, game, gameAt: t, myColor: match?.hostColor ?? null });
  room?.send({ t: 'state', setup, phase: roomStore.get().phase, game });
  scheduleFlag();
}

/** Ends the game when the side to move runs out of time. */
function scheduleFlag() {
  window.clearTimeout(flagTimer);
  if (!match || match.result || !match.clock?.running) return;
  const side = match.clock.running;
  const allowance = side === match.hostColor ? 0 : LAG_CREDIT_MS;
  const left = match.clock[side] - (now() - match.clock.stamp) + allowance;
  flagTimer = window.setTimeout(
    () => {
      if (!match) return;
      const flagged = checkFlag(match, now(), allowance);
      if (flagged) {
        match = flagged;
        publish();
      } else scheduleFlag();
    },
    Math.max(0, left) + 5,
  );
}

// ---------------------------------------------------------------- guest

function guestHandlers() {
  return {
    onLeave: (_id: string, reason: 'left' | 'lost') => hostGone(reason),
    onMessage: (_id: string, msg: RoomMessage) => fromHost(msg),
  };
}

function fromHost(msg: RoomMessage) {
  if (msg.t !== 'state') return;
  const t = now();
  const game = (msg.game as GameView | null) ?? null;
  const myColor = game ? other(game.hostColor) : null;
  if (game && myColor && game.pos.turn === myColor) {
    const key = `${game.number}:${plyOf(game.pos)}`;
    if (turnStart.key !== key) turnStart = { key, at: t };
  }
  patch({ setup: msg.setup as Setup, phase: msg.phase as RoomScreen['phase'], game, gameAt: t, myColor });
}

function hostGone(reason: 'left' | 'lost') {
  const s = roomStore.get();
  if (reason === 'left') {
    room?.abandon();
    room = null;
    window.clearInterval(watchdog);
    if (s.game && !s.game.result && s.myColor) endLocally({ winner: s.myColor, reason: 'left' });
    patch({ status: 'closed', opponentHere: false, notice: 'The host left the room.' });
    return;
  }
  room?.abandon();
  room = null;
  patch({ opponentHere: false, reconnecting: now() + GRACE_MS });
  void rejoinLoop(generation);
}

/** Tries to get back into the room until the grace period runs out. */
async function rejoinLoop(gen: number) {
  let lastKind: RoomError['kind'] = 'offline';
  for (;;) {
    const s = roomStore.get();
    if (gen !== generation || s.reconnecting === null) return;
    const left = s.reconnecting - now();
    if (left <= 0) break;
    try {
      const r = await Room.join(s.code, token, guestHandlers(), Math.min(REJOIN_TRY_MS, Math.max(1000, left)));
      if (gen !== generation) return r.close();
      room = r;
      token = r.token;
      patch({ opponentHere: true, reconnecting: null, notice: 'Back in the room.' });
      return;
    } catch (e) {
      lastKind = e instanceof RoomError ? e.kind : 'offline';
      if (lastKind === 'full') break;
      await new Promise((res) => window.setTimeout(res, 1500));
    }
  }
  if (gen !== generation) return;
  // Gave up. Who was disconnected? If this device could reach the room server
  // but not the host, the host was; if it could not reach the server, or the
  // host already gave the seat away, this device was.
  const s = roomStore.get();
  window.clearInterval(watchdog);
  if (s.game && !s.game.result && s.myColor) {
    const hostAway = lastKind === 'gone' || lastKind === 'silent';
    endLocally({ winner: hostAway ? s.myColor : other(s.myColor), reason: 'forfeit' });
  }
  patch({ status: 'closed', reconnecting: null, notice: 'Lost connection to the room.' });
}

/** The guest ends the game on its own screen (the host is gone). */
function endLocally(result: Result) {
  const s = roomStore.get();
  if (!s.game) return;
  const t = now();
  const clock = s.game.clock
    ? {
        ...s.game.clock,
        ...(s.game.clock.running ? { [s.game.clock.running]: Math.max(0, s.game.clock[s.game.clock.running] - (t - s.gameAt)) } : {}),
        running: null,
      }
    : null;
  patch({ game: { ...s.game, result, clock, drawOffer: null, away: null }, gameAt: t });
}

// ---------------------------------------------------------------- the player's actions (both sides)

export function playerMove(move: Move) {
  const s = roomStore.get();
  if (!s.game || s.game.result || !s.myColor || s.game.pos.turn !== s.myColor) return;
  if (s.role === 'host') {
    if (!match) return;
    const next = moveIn(match, match.hostColor, move, null, now(), dice);
    if (!next) return;
    match = next;
    publish();
    return;
  }
  // Guest: show the move at once; the host's answer replaces this picture.
  const m = findLegal(s.game.pos, move);
  if (!m || !room) return;
  const t = now();
  room.send({ t: 'move', move: { from: move.from, to: move.to, promo: move.promo, mk: move.mk, define: move.define }, used: Math.round(t - turnStart.at) });
  const g = s.game;
  const clock = g.clock ? { ...g.clock, [s.myColor]: g.clock[s.myColor] - (t - s.gameAt), running: other(s.myColor) } : null;
  patch({ game: { ...g, pos: play(g.pos, m), lastMove: m, clock, drawOffer: g.drawOffer === s.myColor ? g.drawOffer : null }, gameAt: t });
}

/** Rental: give up one of your units toward the rent you owe. */
export function playerEvict(sqr: number) {
  const s = roomStore.get();
  if (!s.game || s.game.result || !s.myColor || s.game.pos.turn !== s.myColor) return;
  if (s.role === 'host') {
    if (!match) return;
    const next = evictIn(match, match.hostColor, sqr, null, now());
    if (next) {
      match = next;
      publish();
    }
  } else room?.send({ t: 'evict', sq: sqr, used: Math.round(now() - turnStart.at) });
}

/** Mega Knight: roll the die instead of moving a piece. Remorse: pass on the extra move. Both are decided by the host. */
export function playerAction(a: 'roll' | 'skip') {
  const s = roomStore.get();
  if (!s.game || s.game.result || !s.myColor || s.game.pos.turn !== s.myColor) return;
  if (s.role === 'host') {
    if (!match) return;
    const next = a === 'roll' ? rollIn(match, match.hostColor, null, now(), dice) : skipIn(match, match.hostColor, null, now());
    if (next) {
      match = next;
      publish();
    }
  } else room?.send({ t: a, used: Math.round(now() - turnStart.at) });
}

export function playerResign() {
  const s = roomStore.get();
  if (!s.game || s.game.result) return;
  if (s.role === 'host') {
    if (!match) return;
    match = resign(match, match.hostColor, now()) ?? match;
    publish();
  } else room?.send({ t: 'resign' });
}

export function playerDraw(a: 'offer' | 'accept' | 'decline') {
  const s = roomStore.get();
  if (!s.game || s.game.result) return;
  if (s.role === 'host') {
    if (!match) return;
    const next = a === 'offer' ? offerDraw(match, match.hostColor) : answerDraw(match, match.hostColor, a === 'accept', now());
    if (next) {
      match = next;
      publish();
    }
  } else room?.send({ t: 'draw', a });
}
