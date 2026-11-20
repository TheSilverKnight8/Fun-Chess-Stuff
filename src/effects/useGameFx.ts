import { useEffect, useRef, useState } from 'react';
import { checkers, findKing, inCheck } from '../chess/standard';
import { other, type Color } from '../chess/types';
import { plyOf, type GameView } from '../game/match';
import { setTension } from '../lib/audio/music';
import { PIECE_VALUE, sfx } from '../lib/audio/sfx';
import { ROLL, SLIDE_MS, emitFx, openAt } from './fx';

// Watches the game as it changes and starts the matching effects and sounds:
// a new game, each move (capture, castling, promotion, check), Pot-Hole's
// dice, and the end.
// Works the same on both screens, from what each screen is shown.

const DRAWS = new Set(['stalemate', 'repetition', 'fifty', 'material', 'agreement', 'timeoutDraw', 'palaceBoth']);

interface Seen {
  number: number;
  ply: number;
  ended: boolean;
  offer: Color | null;
  away: boolean;
  reconnecting: boolean;
  /** The half-move of the last Pot-Hole roll shown. */
  rollPly: number;
}

export function useGameFx(game: GameView, me: Color, reconnecting: boolean) {
  const seen = useRef<Seen | null>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  // Pot-Hole: a new pothole stays hidden on the board until the dice have picked its square.
  const [holeHidden, setHoleHidden] = useState(false);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      setTension(false);
      // Forget what was seen, so a screen that mounts again (React does this
      // twice in development) shows the start of the game again.
      seen.current = null;
    },
    [],
  );

  useEffect(() => {
    const prev = seen.current;
    const ply = plyOf(game.pos);
    const now: Seen = { number: game.number, ply, ended: !!game.result, offer: game.drawOffer, away: !!game.away, reconnecting, rollPly: game.roll?.ply ?? -1 };
    seen.current = now;

    const newGame = !prev || prev.number !== game.number;
    if (newGame && ply === 0 && !game.result) {
      emitFx({ t: 'start' });
      sfx.start();
    }

    // One move further than last time: that move's effects.
    let moved = false;
    if (!newGame && prev && ply === prev.ply + 1 && game.lastMove) {
      moved = true;
      const m = game.lastMove;
      const mate = game.result?.reason === 'checkmate';
      const checking = inCheck(game.pos) ? checkers(game.pos) : [];
      emitFx({ t: 'move', m, pos: game.pos, checkers: checking, king: findKing(game.pos, game.pos.turn), mate });
      if (m.captured) {
        later(SLIDE_MS - 10, () => sfx.capture(PIECE_VALUE[m.captured!.kind]));
        if (m.captured.kind === 'K') later(SLIDE_MS + 90, () => sfx.crown());
      }
      else if (m.castle) later(SLIDE_MS - 10, () => sfx.castle());
      else later(SLIDE_MS - 10, () => sfx.move());
      if (m.promo) later(SLIDE_MS + 20, () => sfx.promote());
      if (checking.length && !mate) later(SLIDE_MS + 60, () => sfx.check());
    }

    // Pot-Hole: the dice after a move (on the guest's screen they arrive just after its own move).
    let rollMs = 0;
    const roll = game.roll;
    if (!newGame && prev && roll && roll.ply === ply && roll.ply !== prev.rollPly) {
      emitFx({ t: 'roll', roll });
      if (roll.closed !== null) later(80, () => sfx.patch());
      later(ROLL.dieStart, () => sfx.dice());
      later(ROLL.dieLand, () => sfx.diceLand(roll.d6 % 2 === 0));
      const open = openAt(roll);
      if (open !== null) {
        rollMs = open + 300;
        setHoleHidden(true);
        roll.tries.forEach((_, i) => {
          const base = ROLL.d8Start + i * ROLL.reroll;
          later(base, () => sfx.dice(true));
          later(base + (ROLL.d8Land - ROLL.d8Start), () => sfx.diceLand(true));
          if (i < roll.tries.length - 1) later(ROLL.cross + i * ROLL.reroll + 80, () => sfx.reroll());
        });
        later(open, () => {
          sfx.crack();
          setHoleHidden(false);
        });
        if (roll.removed) later(open + 120, () => sfx.fall());
      } else rollMs = ROLL.dieLand;
    }

    // The game just ended.
    if (game.result && prev && !prev.ended && !newGame) {
      const r = game.result;
      emitFx({ t: 'end', result: r, pos: game.pos, me, afterMove: moved, extraDelay: rollMs });
      const d = (moved ? SLIDE_MS + 260 : 0) + rollMs;
      const won = r.winner === me;
      if (r.reason === 'checkmate') {
        later(d, () => {
          sfx.mateHit();
          if (won) sfx.fanfare();
          else sfx.mateLost();
        });
      } else if (r.reason === 'timeout' || r.reason === 'timeoutDraw') {
        sfx.buzzer();
        later(550, () => (r.winner === null ? sfx.draw() : won ? sfx.win() : sfx.lose()));
      } else if (r.reason === 'resign') {
        sfx.topple();
        later(900, () => (won ? sfx.win() : sfx.lose()));
      } else if (r.reason === 'palace' || r.reason === 'palaceBoth') {
        later(d, () => {
          sfx.crumble();
          later(500, () => (r.winner === null ? sfx.draw() : won ? sfx.fanfare() : sfx.mateLost()));
        });
      } else if (DRAWS.has(r.reason)) later(d, () => sfx.draw());
      else won ? sfx.win() : sfx.lose();
    }

    // Small sounds.
    if (prev && !newGame && !game.result) {
      if (game.drawOffer === other(me) && prev.offer !== other(me)) sfx.offer();
      if (now.away && !prev.away) sfx.lost();
      if (!now.away && prev.away) sfx.back();
      if (now.reconnecting && !prev.reconnecting) sfx.lost();
      if (!now.reconnecting && prev.reconnecting) sfx.back();
    }
  }, [game, me, reconnecting]);

  return { holeHidden };
}

/** Plays a tick each second in the last ten seconds of your own running clock. */
export function useClockTicks(msLeft: number | null, running: boolean) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!running || msLeft === null || msLeft >= 10_000 || msLeft <= 0) {
      last.current = null;
      return;
    }
    const sec = Math.ceil(msLeft / 1000);
    if (last.current !== null && sec < last.current) sfx.tick();
    last.current = sec;
  });
}
