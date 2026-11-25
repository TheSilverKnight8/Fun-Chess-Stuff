import { useEffect, useRef, useState } from 'react';
import type { Color, Position } from '../chess/types';
import type { Transfer } from '../chess/revival';
import type { GameView } from '../game/match';
import { sfx } from '../lib/audio/sfx';
import { FLIP_MS, REVIVAL, emitFx } from './fx';

// Revival's board view (Caleb's design): only one board is visible, the main
// board by default; a button flips to the auxiliary board. When units move
// between boards, each one leaves with an effect, the view switches to the
// other board by itself, and it arrives with an effect.
//
// Stage 7 (Caleb): the auxiliary board is the dead board, drawn dark, and the
// switch between the two is a slower, dramatic transition in two halves: the
// old board goes out, then the new one comes in. Everything waits its turn: the
// move slides, the piece leaves, the board turns, the piece arrives.

export type BoardName = 'main' | 'aux';
/** Which half of a board switch is playing: the old board going out, or the new one coming in. */
export type FlipPhase = { phase: 'out' | 'in'; to: BoardName } | null;

const key = (board: BoardName, sq: number) => `${board}:${sq}`;

export function useRevival(game: GameView, me: Color) {
  const revival = game.pos.revival;
  const [view, setViewState] = useState<BoardName>('main');
  const [flips, setFlips] = useState(0);
  const [flip, setFlip] = useState<FlipPhase>(null);
  /** Squares whose arriving piece is not shown yet (its beam has not landed). */
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const timers = useRef<number[]>([]);
  const flipTimers = useRef<number[]>([]);
  const lastKey = useRef('');
  const viewRef = useRef<BoardName>('main');
  /** The board the player last chose with the button (main at the start): the view comes back here after automatic switches. */
  const chosen = useRef<BoardName>('main');

  /** Turn the view to a board: the old one goes out, the board changes, the new one comes in. */
  const setView = (v: BoardName) => {
    if (viewRef.current === v) return;
    viewRef.current = v;
    flipTimers.current.forEach((t) => window.clearTimeout(t));
    flipTimers.current = [];
    setFlip({ phase: 'out', to: v });
    sfx.flip();
    flipTimers.current.push(
      window.setTimeout(() => {
        setViewState(v);
        setFlips((n) => n + 1);
        setFlip({ phase: 'in', to: v });
      }, REVIVAL.flipOut),
      window.setTimeout(() => setFlip(null), FLIP_MS),
    );
  };

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      flipTimers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const transferKey = revival ? `${game.number}:${JSON.stringify(game.transfers)}:${JSON.stringify(revival.queue.map((a) => a.piece.id))}` : '';
  // Arriving pieces are hidden from the very first frame the new position is shown.
  const fresh = !!revival && transferKey !== lastKey.current && lastKey.current !== '' && game.transfers.length > 0;
  const arriving = fresh ? new Set((game.transfers as Transfer[]).flatMap((tr) => (tr.to && !tr.gone ? [key(tr.to.board, tr.to.sq)] : []))) : null;

  // Play the pieces that changed boards, one after the other.
  useEffect(() => {
    if (!revival) return;
    if (transferKey === lastKey.current) return;
    const first = lastKey.current === '';
    lastKey.current = transferKey;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (first || !game.transfers.length) {
      setHidden(new Set());
      // A piece waiting for my choice: show its board.
      const head = revival.queue[0];
      if (head && head.owner === me) setView(head.board);
      return;
    }
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const waiting = new Set(arriving ?? []);
    setHidden(new Set(waiting));
    // The board the player chose themselves (Claude Code's call: the view goes back there afterwards).
    const home = chosen.current;
    // The move slides first; the view is followed as it will be after each step.
    let t = REVIVAL.lead;
    let shownBoard = viewRef.current;
    const turnTo = (b: BoardName) => {
      if (shownBoard === b) return;
      shownBoard = b;
      at(t, () => setView(b));
      t += FLIP_MS;
    };
    for (const tr of game.transfers as Transfer[]) {
      turnTo(tr.from.board);
      at(t, () => {
        emitFx(tr.gone ? { t: 'gone', piece: tr.piece, sq: tr.from.sq, board: tr.from.board } : { t: 'leave', piece: tr.piece, sq: tr.from.sq, board: tr.from.board });
        tr.gone ? sfx.collapse() : sfx.leave();
      });
      t += REVIVAL.leave;
      if (tr.gone) continue;
      const dest: BoardName = tr.from.board === 'main' ? 'aux' : 'main';
      turnTo(dest);
      t += REVIVAL.settle;
      if (tr.to) {
        const to = tr.to;
        at(t, () => {
          emitFx({ t: 'enter', piece: tr.piece, sq: to.sq, board: to.board });
          sfx.enter();
        });
        at(t + REVIVAL.reveal, () => {
          waiting.delete(key(to.board, to.sq));
          setHidden(new Set(waiting));
        });
        t += REVIVAL.enter;
      } else t += 300;
    }
    // Afterwards: a piece waiting for my choice keeps its board in view; otherwise back to where I was.
    at(t, () => setHidden(new Set()));
    const head = revival.queue[0];
    if (head && head.owner === me) at(t, () => setView(head.board));
    else at(t + REVIVAL.back, () => setView(home));
  });

  const pos = game.pos;
  const hide = arriving ?? hidden;
  const strip = (board: Position['board'], name: BoardName) => (hide.size ? board.map((p, i) => (hide.has(key(name, i)) ? null : p)) : board);
  /** The visible board as a position of its own (so the board shows and moves only on it). */
  const shown: Position | null = !revival
    ? null
    : view === 'main'
      ? { ...pos, board: strip(pos.board, 'main'), variant: 'standard', revival: undefined }
      : { ...pos, board: strip(revival.aux, 'aux'), ep: revival.auxEp, castling: { w: { k: false, q: false }, b: { k: false, q: false } }, variant: 'revivalAux', revival: undefined };

  /** The flip button: the player's own choice. */
  const toggle = (v: BoardName) => {
    chosen.current = v;
    setView(v);
  };

  /** Pieces are still changing boards (the board waits before it takes moves). */
  const busy = flip !== null || hide.size > 0;

  return { view, setView: toggle, flips, flip, shown, busy };
}
