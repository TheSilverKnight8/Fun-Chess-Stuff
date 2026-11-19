import { useEffect, useRef } from 'react';
import { checkers, findKing, inCheck } from '../chess/standard';
import { other, type Color } from '../chess/types';
import { plyOf, type GameView } from '../game/match';
import { setTension } from '../lib/audio/music';
import { PIECE_VALUE, sfx } from '../lib/audio/sfx';
import { SLIDE_MS, emitFx } from './fx';

// Watches the game as it changes and starts the matching effects and sounds:
// a new game, each move (capture, castling, promotion, check), and the end.
// Works the same on both screens, from what each screen is shown.

const DRAWS = new Set(['stalemate', 'repetition', 'fifty', 'material', 'agreement', 'timeoutDraw']);

interface Seen {
  number: number;
  ply: number;
  ended: boolean;
  offer: Color | null;
  away: boolean;
  reconnecting: boolean;
}

export function useGameFx(game: GameView, me: Color, reconnecting: boolean) {
  const seen = useRef<Seen | null>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

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
    const now: Seen = { number: game.number, ply, ended: !!game.result, offer: game.drawOffer, away: !!game.away, reconnecting };
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
      if (m.captured) later(SLIDE_MS - 10, () => sfx.capture(PIECE_VALUE[m.captured!.kind]));
      else if (m.castle) later(SLIDE_MS - 10, () => sfx.castle());
      else later(SLIDE_MS - 10, () => sfx.move());
      if (m.promo) later(SLIDE_MS + 20, () => sfx.promote());
      if (checking.length && !mate) later(SLIDE_MS + 60, () => sfx.check());
    }

    // The game just ended.
    if (game.result && prev && !prev.ended && !newGame) {
      const r = game.result;
      emitFx({ t: 'end', result: r, pos: game.pos, me, afterMove: moved });
      const d = moved ? SLIDE_MS + 260 : 0;
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
