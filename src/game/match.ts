// One game in a room, as the host's device runs it (the host's device is the
// referee: it checks every move, runs both clocks and ends the game). The guest
// is sent a view of it after every change. Plain objects only.

import { boardEnd, newBoardGame, playMove, repetitionKey, sideCannotMate, type BoardGame } from '../chess/status';
import { formMegaKnights } from '../chess/standard';
import { rollMega } from '../chess/megaknight';
import { remorseStep, skipExtra, type RemorseEvent } from '../chess/remorse';
import { startPosition } from '../chess/standard';
import { potholeStep, type PotholeDuration, type Rand, type Roll } from '../chess/pothole';
import { other, sq, type Color, type Move, type MoveInfo, type Position } from '../chess/types';
import type { ModeId } from '../modes';
import type { Variant } from '../chess/types';
import type { TimeControl } from './time';

export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'repetition'
  | 'fifty'
  | 'material'
  /** Ran out of time; the other side wins. */
  | 'timeout'
  /** Ran out of time, but the other side cannot checkmate (Caleb's answer): a draw. */
  | 'timeoutDraw'
  | 'resign'
  | 'agreement'
  /** Lost connection and did not come back within the grace period. */
  | 'forfeit'
  /** Left the room during the game. */
  | 'left'
  /** Bastille: the loser's palace was emptied. */
  | 'palace'
  /** Bastille: one move emptied both palaces (a draw). */
  | 'palaceBoth'
  /** Mega Knight: a king was crushed. Remorse: a king captured itself, or its own bloodlust piece took it. */
  | 'kingLost';

export interface Result {
  winner: Color | null;
  reason: EndReason;
}

/**
 * How much of the network delay the host forgives on each of the guest's
 * moves. The guest's device times its own thinking; the host uses that, but
 * never less than its own measurement minus this much.
 */
export const LAG_CREDIT_MS = 1000;

/** Options the host sets for a mode (spec: "sets any mode options"). */
export interface ModeOptions {
  /** Pot-Hole: base rule (one turn) or the authors' random duration. */
  potholeDuration: PotholeDuration;
}

export const DEFAULT_OPTIONS: ModeOptions = { potholeDuration: 'base' };

const VARIANT: Partial<Record<ModeId, Variant>> = { bastille: 'bastille', pothole: 'pothole', megaknight: 'megaknight', remorse: 'remorse' };

export interface MatchState {
  /** Counts the games in this room, so a view can tell a new game from the last one. */
  number: number;
  mode: ModeId;
  time: TimeControl;
  hostColor: Color;
  game: BoardGame;
  /** Time left for each side as of `stamp` (host's performance.now()). null = untimed. */
  clock: { w: number; b: number; running: Color | null; stamp: number } | null;
  /** The side that offered a draw, while the offer is open. */
  drawOffer: Color | null;
  result: Result | null;
  options: ModeOptions;
  /** Pot-Hole: the dice after the last move. */
  roll: Roll | null;
  /** Remorse: what the last move did to statuses. */
  remorse: RemorseEvent | null;
  /** Mega Knight: the last roll, and its half-move. */
  mkRoll: { ply: number; d6: number } | null;
  /** Mega Knight: mega knights formed from four knights by the last move. */
  formed: number[];
}

/** What both screens show. Clock times are as of the moment the view was made. */
export interface GameView {
  number: number;
  mode: ModeId;
  time: TimeControl;
  hostColor: Color;
  pos: Position;
  lastMove: MoveInfo | null;
  clock: { w: number; b: number; running: Color | null } | null;
  drawOffer: Color | null;
  result: Result | null;
  options: ModeOptions;
  roll: Roll | null;
  remorse: RemorseEvent | null;
  mkRoll: { ply: number; d6: number } | null;
  formed: number[];
  /** A player who lost connection, and how long they have to come back. */
  away: { color: Color; msLeft: number } | null;
}

export function newMatch(number: number, mode: ModeId, time: TimeControl, hostColor: Color, now: number, options: ModeOptions = DEFAULT_OPTIONS): MatchState {
  const ms = time ? time.minutes * 60_000 : 0;
  return {
    number,
    mode,
    time,
    hostColor,
    game: newBoardGame(startFor(mode)),
    // White's clock runs from the start of the game.
    clock: time ? { w: ms, b: ms, running: 'w', stamp: now } : null,
    drawOffer: null,
    result: null,
    options,
    roll: null,
    remorse: null,
    mkRoll: null,
    formed: [],
  };
}

/** The starting position of a mode. Mega Knight: one mega knight in the centre (d4, e4, d5, e5). */
function startFor(mode: ModeId): Position {
  const pos = startPosition(VARIANT[mode] ?? 'standard');
  if (mode === 'megaknight') return { ...pos, mk: [sq(3, 3)] };
  return pos;
}

/** Time left for a side right now. */
export function timeLeft(m: MatchState, color: Color, now: number): number {
  if (!m.clock) return Infinity;
  const base = m.clock[color];
  return m.clock.running === color ? base - (now - m.clock.stamp) : base;
}

function stopClock(m: MatchState, now: number): MatchState['clock'] {
  if (!m.clock) return null;
  const c = { ...m.clock };
  if (c.running) c[c.running] = Math.max(0, c[c.running] - (now - c.stamp));
  c.running = null;
  c.stamp = now;
  return c;
}

function end(m: MatchState, result: Result, now: number): MatchState {
  return { ...m, result, drawOffer: null, clock: stopClock(m, now) };
}

/** Running out of time loses, unless the opponent could never checkmate (then a draw). */
function timeoutResult(m: MatchState, flagged: Color): Result {
  const opp = other(flagged);
  // Bastille: insufficient material does not apply (section 6), so running out of time always loses (Claude Code's reading).
  if (m.game.pos.variant === 'bastille') return { winner: opp, reason: 'timeout' };
  return sideCannotMate(m.game.pos, opp) ? { winner: null, reason: 'timeoutDraw' } : { winner: opp, reason: 'timeout' };
}

/**
 * A player's move. `reported` is the guest's own measure of how long they
 * thought (null for the host, whose time the host's device measures itself).
 * Returns null if the move is not allowed.
 */
/** Runs one action of the player to move with the clock: their time is charged; the increment is added only when the turn passes to the other player. */
function takeTurn(m: MatchState, color: Color, reported: number | null, now: number, act: (g: BoardGame) => { game: BoardGame; patch?: Partial<MatchState> } | null): MatchState | null {
  if (m.result || m.game.pos.turn !== color) return null;
  const clock = m.clock ? { ...m.clock } : null;
  let used = 0;
  if (clock && m.time) {
    const measured = now - clock.stamp;
    used = reported === null ? measured : Math.min(measured, Math.max(reported, measured - LAG_CREDIT_MS));
    if (used >= clock[color]) return end(m, timeoutResult(m, color), now);
  }
  const done = act(m.game);
  if (!done) return null;
  const { game } = done;
  const passed = game.pos.turn !== color;
  if (clock && m.time) {
    clock[color] = clock[color] - used + (passed ? m.time.increment * 1000 : 0);
    clock.running = passed ? other(color) : color;
    clock.stamp = now;
  }
  // A draw offer stays open until the player it was made to moves (or answers it).
  const drawOffer = m.drawOffer && m.drawOffer !== color ? null : m.drawOffer;
  const next: MatchState = { ...m, game, clock, drawOffer, roll: null, remorse: null, mkRoll: null, formed: [], ...done.patch };
  if (game.end) {
    const e = game.end;
    return end(next, 'winner' in e ? { winner: e.winner, reason: e.reason } : { winner: null, reason: e.reason }, now);
  }
  return next;
}

/**
 * A player's move. `reported` is the guest's own measure of how long they
 * thought (null for the host, whose time the host's device measures itself).
 * Returns null if the move is not allowed.
 */
export function moveIn(m: MatchState, color: Color, move: Move, reported: number | null, now: number, rand?: Rand): MatchState | null {
  return takeTurn(m, color, reported, now, (g) => {
    const variant = g.pos.variant;
    const ply = plyOf(g.pos) + 1;
    let roll: Roll | null = null;
    let remorse: RemorseEvent | null = null;
    let formed: number[] = [];
    let after: ((pos: Position, mi: MoveInfo, prev: Position) => Position) | undefined;
    // Pot-Hole: the host rolls the dice within the turn, after the move.
    if (variant === 'pothole' && rand)
      after = (pos) => {
        const r = potholeStep(pos, ply, rand, m.options.potholeDuration);
        roll = r.roll;
        return r.pos;
      };
    // Mega Knight: four knights in a 2x2 become a mega knight.
    if (variant === 'megaknight')
      after = (pos) => {
        const r = formMegaKnights(pos);
        formed = r.formed;
        return r.pos;
      };
    // Remorse: the capturing piece's roll, absolving, extra moves, self-captures.
    if (variant === 'remorse' && rand)
      after = (pos, mi, prev) => {
        const r = remorseStep(prev, pos, mi, ply, rand);
        remorse = r.ev;
        return r.pos;
      };
    const game = playMove(g, move, after);
    if (!game) return null;
    return { game, patch: { roll, remorse, formed } };
  });
}

/** Mega Knight: the player to move rolls the die instead of moving a piece. */
export function rollIn(m: MatchState, color: Color, reported: number | null, now: number, rand: Rand): MatchState | null {
  if (m.game.pos.variant !== 'megaknight' || m.game.pos.mkRoll) return null;
  return takeTurn(m, color, reported, now, (g) => {
    const d6 = rand(6) + 1;
    return { game: rollMega(g, d6), patch: { mkRoll: { ply: plyOf(g.pos), d6 } } };
  });
}

/** Remorse: the player passes on their psychopath's extra move. */
export function skipIn(m: MatchState, color: Color, reported: number | null, now: number): MatchState | null {
  const pos = m.game.pos;
  if (pos.variant !== 'remorse' || pos.extra === null || pos.extra === undefined) return null;
  return takeTurn(m, color, reported, now, (g) => {
    const r = skipExtra(g.pos, plyOf(g.pos));
    const key = repetitionKey(r.pos);
    const game: BoardGame = { pos: r.pos, seen: { ...g.seen, [key]: (g.seen[key] ?? 0) + 1 }, lastMove: g.lastMove, end: null };
    game.end = boardEnd(game);
    return { game, patch: { remorse: r.ev } };
  });
}

/**
 * Has the side to move run out of time? `allowance` is extra time before the
 * flag falls (the guest's network credit; 0 for the host).
 */
export function checkFlag(m: MatchState, now: number, allowance: number): MatchState | null {
  if (m.result || !m.clock?.running) return null;
  const c = m.clock.running;
  if (timeLeft(m, c, now) + allowance > 0) return null;
  return end(m, timeoutResult(m, c), now);
}

export function resign(m: MatchState, color: Color, now: number): MatchState | null {
  if (m.result) return null;
  return end(m, { winner: other(color), reason: 'resign' }, now);
}

export function offerDraw(m: MatchState, color: Color): MatchState | null {
  if (m.result || m.drawOffer) return null;
  return { ...m, drawOffer: color };
}

export function answerDraw(m: MatchState, color: Color, accept: boolean, now: number): MatchState | null {
  if (m.result || !m.drawOffer || m.drawOffer === color) return null;
  return accept ? end(m, { winner: null, reason: 'agreement' }, now) : { ...m, drawOffer: null };
}

export function forfeit(m: MatchState, color: Color, reason: 'forfeit' | 'left', now: number): MatchState | null {
  if (m.result) return null;
  return end(m, { winner: other(color), reason }, now);
}

export function viewOf(m: MatchState, now: number, away: GameView['away']): GameView {
  return {
    number: m.number,
    mode: m.mode,
    time: m.time,
    hostColor: m.hostColor,
    pos: m.game.pos,
    lastMove: m.game.lastMove,
    clock: m.clock ? { w: timeLeft(m, 'w', now), b: timeLeft(m, 'b', now), running: m.clock.running } : null,
    drawOffer: m.drawOffer,
    result: m.result,
    options: m.options,
    roll: m.roll,
    remorse: m.remorse,
    mkRoll: m.mkRoll,
    formed: m.formed,
    away,
  };
}

/** Half-moves played so far; identifies whose turn it is in which game. */
export const plyOf = (pos: Position) => (pos.fullmove - 1) * 2 + (pos.turn === 'b' ? 1 : 0);

export const RESULT_TEXT: Record<EndReason, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  repetition: 'Threefold repetition',
  fifty: 'Fifty-move rule',
  material: 'Insufficient material',
  timeout: 'Out of time',
  timeoutDraw: 'Out of time against insufficient material',
  resign: 'Resignation',
  agreement: 'Draw agreed',
  forfeit: 'Disconnected',
  left: 'Left the game',
  palace: 'Palace emptied',
  palaceBoth: 'Both palaces emptied',
  kingLost: 'King lost',
};
