import { useEffect, useRef, useState } from 'react';
import type { Color, Position } from '../chess/types';
import type { Transfer } from '../chess/revival';
import type { GameView } from '../game/match';
import { sfx } from '../lib/audio/sfx';
import { emitFx } from './fx';

// Revival's board view (Caleb's design): only one board is visible, the main
// board by default; a button flips to the auxiliary board. When units move
// between boards, each one leaves with an effect, the view switches to the
// other board by itself, and it arrives with an effect.

export type BoardName = 'main' | 'aux';

const LEAVE_MS = 550;
const ENTER_MS = 650;

export function useRevival(game: GameView, me: Color) {
  const revival = game.pos.revival;
  const [view, setViewState] = useState<BoardName>('main');
  const [flips, setFlips] = useState(0);
  const timers = useRef<number[]>([]);
  const lastKey = useRef('');
  const viewRef = useRef<BoardName>('main');

  const setView = (v: BoardName, sound = true) => {
    if (viewRef.current === v) return;
    viewRef.current = v;
    setViewState(v);
    setFlips((n) => n + 1);
    if (sound) sfx.flip();
  };

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Play the pieces that changed boards, one after the other.
  useEffect(() => {
    if (!revival) return;
    const key = `${game.number}:${JSON.stringify(game.transfers)}:${JSON.stringify(revival.queue.map((a) => a.piece.id))}`;
    if (key === lastKey.current) return;
    const first = lastKey.current === '';
    lastKey.current = key;
    if (first || !game.transfers.length) {
      // A piece waiting for my choice: show its board.
      const head = revival.queue[0];
      if (head && head.owner === me) setView(head.board);
      return;
    }
    let t = 0;
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    for (const tr of game.transfers as Transfer[]) {
      const start = t;
      at(start, () => {
        setView(tr.from.board);
      });
      at(start + 120, () => {
        emitFx(tr.gone ? { t: 'gone', piece: tr.piece, sq: tr.from.sq, board: tr.from.board } : { t: 'leave', piece: tr.piece, sq: tr.from.sq, board: tr.from.board });
        tr.gone ? sfx.collapse() : sfx.leave();
      });
      t += 120 + LEAVE_MS;
      if (tr.gone) continue;
      const dest: BoardName = tr.from.board === 'main' ? 'aux' : 'main';
      at(t, () => setView(dest));
      if (tr.to) {
        const to = tr.to;
        at(t + 250, () => {
          emitFx({ t: 'enter', piece: tr.piece, sq: to.sq, board: to.board });
          sfx.enter();
        });
        t += 250 + ENTER_MS;
      } else t += 300;
    }
    // A piece now waiting for my choice: end on its board.
    const head = revival.queue[0];
    if (head && head.owner === me) at(t, () => setView(head.board));
  });

  const pos = game.pos;
  /** The visible board as a position of its own (so the board shows and moves only on it). */
  const shown: Position | null = !revival
    ? null
    : view === 'main'
      ? { ...pos, variant: 'standard', revival: undefined }
      : { ...pos, board: revival.aux, ep: revival.auxEp, castling: { w: { k: false, q: false }, b: { k: false, q: false } }, variant: 'revivalAux', revival: undefined };

  return { view, setView, flips, shown };
}
