import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { findKing, inCheck, legalMoves } from '../chess/standard';
import { KIND_NAME, fileOf, rankOf, sq, type Color, type Move, type MoveInfo, type Position, type PromoKind } from '../chess/types';
import { cx } from '../components/ui';
import { PieceArt } from './PieceArt';

// The board. Moves are made either way the spec asks for (section 4): click the
// piece then the square, or drag the piece onto the square. Only the player
// whose turn it is can pick up their own pieces.

export interface BoardProps {
  pos: Position;
  /** The color at the bottom of the board (the player's own). */
  orientation: Color;
  /** The player may move now (their turn, game going on). */
  canMove: boolean;
  lastMove: MoveInfo | null;
  showLegal: boolean;
  showLast: boolean;
  onMove: (move: Move) => void;
}

const PROMO_ORDER: PromoKind[] = ['Q', 'R', 'B', 'N'];
const DRAG_START_PX = 4;

interface Drag {
  from: number;
  pointerId: number;
  startX: number;
  startY: number;
  /** Pointer position inside the board, in board fractions (0..1). */
  x: number;
  y: number;
  moving: boolean;
  /** The piece was already selected when it was pressed: a plain click puts it down again. */
  wasSelected: boolean;
}

export function Board({ pos, orientation, canMove, lastMove, showLegal, showLast, onMove }: BoardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);

  const moves = useMemo(() => (canMove ? legalMoves(pos) : []), [pos, canMove]);
  // Forget a selection that no longer makes sense (the position changed under it).
  const sel = selected !== null && canMove && pos.board[selected]?.color === pos.turn ? selected : null;
  const targets = useMemo(() => {
    const t = new Map<number, boolean>();
    if (sel === null) return t;
    for (const m of moves) if (m.from === sel) t.set(m.to, !!m.captured);
    return t;
  }, [moves, sel]);

  const flip = orientation === 'b';
  /** Screen column and row (0 = left / top) of a square. */
  const place = (s: number) => (flip ? { col: 7 - fileOf(s), row: rankOf(s) } : { col: fileOf(s), row: 7 - rankOf(s) });
  const squareAt = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const col = Math.floor(((clientX - r.left) / r.width) * 8);
    const row = Math.floor(((clientY - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return flip ? sq(7 - col, row) : sq(col, 7 - row);
  };
  const fraction = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height };
  };

  const tryMove = (from: number, to: number) => {
    const options = moves.filter((m) => m.from === from && m.to === to);
    if (options.length === 0) return false;
    if (options.some((m) => m.promo)) setPromo({ from, to });
    else onMove({ from, to });
    setSelected(null);
    return true;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (promo || e.button > 0) return;
    const s = squareAt(e.clientX, e.clientY);
    if (s === null || !canMove) return;
    const piece = pos.board[s];
    if (piece && piece.color === pos.turn) {
      e.currentTarget.setPointerCapture(e.pointerId);
      const f = fraction(e.clientX, e.clientY);
      setDrag({ from: s, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, ...f, moving: false, wasSelected: sel === s });
      setSelected(s);
      return;
    }
    if (sel !== null && tryMove(sel, s)) return;
    setSelected(null);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const moving = drag.moving || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_START_PX;
    setDrag({ ...drag, ...fraction(e.clientX, e.clientY), moving });
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    setDrag(null);
    if (!d.moving) {
      // A click on the piece that was already picked puts it down.
      if (d.wasSelected) setSelected(null);
      return;
    }
    const to = squareAt(e.clientX, e.clientY);
    if (to !== null && to !== d.from) tryMove(d.from, to);
  };

  const hoverSquare = drag?.moving ? squareAt(...toClient(ref.current, drag)) : null;
  const checkSq = inCheck(pos) ? findKing(pos, pos.turn) : null;
  const pieces = pos.board.flatMap((p, s) => (p ? [{ p, s }] : []));

  return (
    <div
      ref={ref}
      data-board={orientation}
      className="game-surface relative aspect-square w-full touch-none overflow-hidden rounded-md border-[3px] border-navy bg-[var(--sq-light)] shadow-card [container-type:inline-size]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Squares, last move, check, coordinates. */}
      {Array.from({ length: 64 }, (_, s) => {
        const { col, row } = place(s);
        const light = (fileOf(s) + rankOf(s)) % 2 === 1;
        const isLast = showLast && lastMove && (lastMove.from === s || lastMove.to === s);
        return (
          <div
            key={s}
            className="absolute"
            style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%`, width: '12.5%', height: '12.5%', background: light ? 'var(--sq-light)' : 'var(--sq-dark)' }}
          >
            {isLast && <div className="absolute inset-0 bg-[var(--sq-last)]" />}
            {checkSq === s && <div className="absolute inset-0 bg-[radial-gradient(circle,var(--accent)_0%,color-mix(in_srgb,var(--accent)_55%,transparent)_45%,transparent_72%)]" />}
            {sel === s && <div className="absolute inset-0 bg-[var(--sq-selected)]" />}
            {hoverSquare === s && targets.has(s) && <div className="absolute inset-0 border-[3px] border-navy/70" />}
            {row === 7 && (
              <span className={cx('absolute bottom-[2%] right-[5%] font-display text-[clamp(8px,1.9cqw,14px)] leading-none', light ? 'text-[var(--sq-dark-ink)]' : 'text-[var(--sq-light)]')}>
                {'abcdefgh'[fileOf(s)]}
              </span>
            )}
            {col === 0 && (
              <span className={cx('absolute left-[5%] top-[3%] font-display text-[clamp(8px,1.9cqw,14px)] leading-none', light ? 'text-[var(--sq-dark-ink)]' : 'text-[var(--sq-light)]')}>
                {rankOf(s) + 1}
              </span>
            )}
          </div>
        );
      })}

      {/* Pieces. Keyed by piece, so a moving piece slides to its new square. */}
      {pieces.map(({ p, s }) => {
        const { col, row } = place(s);
        const dragged = drag?.moving && drag.from === s;
        return (
          <div
            key={p.id}
            className={cx('pointer-events-none absolute left-0 top-0 h-[12.5%] w-[12.5%] transition-transform duration-150 ease-out', dragged && 'opacity-30')}
            style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}
          >
            <PieceArt color={p.color} kind={p.kind} className="h-full w-full" />
          </div>
        );
      })}

      {/* Where the picked piece can go (a setting, on by default). */}
      {showLegal &&
        [...targets].map(([s, capture]) => {
          const { col, row } = place(s);
          return (
            <div key={`t${s}`} className="pointer-events-none absolute flex items-center justify-center" style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%`, width: '12.5%', height: '12.5%' }}>
              {capture ? <div className="h-full w-full rounded-full border-[5px] border-navy/40" /> : <div className="h-[28%] w-[28%] rounded-full bg-navy/40" />}
            </div>
          );
        })}

      {/* The piece being dragged follows the pointer. */}
      {drag?.moving && pos.board[drag.from] && (
        <div className="pointer-events-none absolute z-10 h-[12.5%] w-[12.5%] -translate-x-1/2 -translate-y-1/2 scale-110" style={{ left: `${drag.x * 100}%`, top: `${drag.y * 100}%` }}>
          <PieceArt color={pos.board[drag.from]!.color} kind={pos.board[drag.from]!.kind} className="h-full w-full drop-shadow-[0_6px_6px_rgb(0_38_87/0.25)]" />
        </div>
      )}

      {/* Promotion: pick the new piece. */}
      {promo && (
        <PromotionPicker
          col={place(promo.to).col}
          fromTop={place(promo.to).row === 0}
          color={pos.turn}
          onPick={(k) => {
            onMove({ ...promo, promo: k });
            setPromo(null);
          }}
          onCancel={() => setPromo(null)}
        />
      )}
    </div>
  );
}

function toClient(el: HTMLDivElement | null, d: Drag): [number, number] {
  if (!el) return [-1, -1];
  const r = el.getBoundingClientRect();
  return [r.left + d.x * r.width, r.top + d.y * r.height];
}

function PromotionPicker({ col, fromTop, color, onPick, onCancel }: { col: number; fromTop: boolean; color: Color; onPick: (k: PromoKind) => void; onCancel: () => void }) {
  return (
    <div
      className="absolute inset-0 z-20 animate-fade bg-navy/35"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-label="Promote to"
        className={cx('absolute flex w-[12.5%] animate-pop flex-col overflow-hidden rounded-md border-[3px] border-navy bg-surface shadow-pop', !fromTop && 'flex-col-reverse')}
        style={{ left: `${col * 12.5}%`, [fromTop ? 'top' : 'bottom']: 0 }}
      >
        {PROMO_ORDER.map((k) => (
          <button key={k} type="button" aria-label={`Promote to ${KIND_NAME[k]}`} className="aspect-square w-full transition hover:bg-raised" onPointerDown={(e) => e.stopPropagation()} onClick={() => onPick(k)}>
            <PieceArt color={color} kind={k} className="h-full w-full" />
          </button>
        ))}
      </div>
    </div>
  );
}
