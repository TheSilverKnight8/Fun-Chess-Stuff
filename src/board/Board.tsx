import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { findKing, inCheck, legalMoves } from '../chess/standard';
import { palaceCount } from '../chess/status';
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
  /** Effects (Stage 2): pieces drop in at the start of a game. */
  intro?: boolean;
  /** Effects: a king that has fallen (checkmated: fast; resigned: slowly tipping over). */
  fallen?: { color: Color; slow: boolean } | null;
  /** Effects: the board drains to grey for a moment (a draw). */
  drained?: boolean;
  /** Pot-Hole: hide the open pothole for now (its opening is still being animated). */
  holeHidden?: boolean;
  /** Pot-Hole (random duration): show the pothole's turns left as pips. */
  showTurns?: boolean;
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

export function Board({ pos, orientation, canMove, lastMove, showLegal, showLast, onMove, intro = false, fallen = null, drained = false, holeHidden = false, showTurns = false }: BoardProps) {
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
      className={cx(
        'game-surface relative aspect-square w-full touch-none overflow-hidden rounded-md border-[3px] border-navy bg-[var(--sq-light)] shadow-card [container-type:inline-size]',
        drained && 'animate-drain',
      )}
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
            {checkSq === s && <div className="animate-check-pulse absolute inset-0 bg-[radial-gradient(circle,var(--accent)_0%,color-mix(in_srgb,var(--accent)_55%,transparent)_45%,transparent_72%)]" />}
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

      {/* Pot-Hole: the open pothole, a dark pit with cracked edges. */}
      {pos.hole && !holeHidden && <Pothole {...place(pos.hole.sq)} turns={showTurns ? pos.hole.turns : 0} />}

      {/* Bastille: each side's palace, walled. */}
      {pos.variant === 'bastille' && (['w', 'b'] as const).map((c) => <PalaceWall key={c} color={c} flip={flip} pos={pos} />)}

      {/* Pieces. Keyed by piece, so a moving piece slides to its new square. */}
      {pieces.map(({ p, s }) => {
        const { col, row } = place(s);
        const dragged = drag?.moving && drag.from === s;
        const promoted = lastMove?.promo && lastMove.to === s && p.kind === lastMove.promo && p.id === pos.nextId - 1;
        const down = fallen && p.kind === 'K' && p.color === fallen.color;
        return (
          <div
            key={p.id}
            className={cx('pointer-events-none absolute left-0 top-0 h-[12.5%] w-[12.5%] transition-transform duration-150 ease-out', dragged && 'opacity-30')}
            style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}
          >
            <div
              className={cx('h-full w-full', intro && 'animate-drop-in', promoted && 'animate-promote', down && (fallen.slow ? 'animate-topple-slow' : 'animate-topple'))}
              style={intro ? { animationDelay: `${(7 - row) * 70 + col * 12}ms` } : undefined}
            >
              <PieceArt color={p.color} kind={p.kind} className="h-full w-full" />
            </div>
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

/** An open pothole: a jagged dark pit filling most of the square, with cracks running out. */
function Pothole({ col, row, turns }: { col: number; row: number; turns: number }) {
  return (
    <div className="pointer-events-none absolute animate-pop" style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%`, width: '12.5%', height: '12.5%' }} data-hole>
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <path d="M2 18 L14 4 L30 9 L46 1 L62 8 L80 3 L97 16 L93 34 L99 52 L92 70 L98 88 L80 97 L62 92 L44 99 L28 93 L10 98 L3 80 L8 62 L1 44 L7 30 Z" fill="#6b5640" />
        <path d="M10 22 L20 11 L34 15 L48 8 L63 14 L78 10 L90 21 L86 37 L91 53 L85 69 L90 84 L76 90 L61 85 L45 92 L30 86 L15 90 L10 76 L15 60 L9 45 L14 32 Z" fill="#0b1626" />
        <path d="M22 30 L40 40 L36 58 M60 26 L58 44 L76 52 M34 74 L50 64 L68 72" fill="none" stroke="#1d2c44" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {turns > 0 && (
        <div className="absolute inset-x-0 bottom-[8%] flex justify-center gap-[6%]">
          {Array.from({ length: turns }, (_, i) => (
            <span key={i} className="block aspect-square w-[11%] rounded-full bg-[var(--sq-light)] shadow-[0_0_0_1px_var(--navy)]" />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Bastille: a crenellated wall around a palace's four squares. It pulses red when
 * the palace is down to its last own piece, and lies in ruins when it is empty.
 */
function PalaceWall({ color, flip, pos }: { color: Color; flip: boolean; pos: Position }) {
  const count = palaceCount(pos, color);
  const top = (color === 'w') !== flip ? 6 : 0;
  // Wall outline around columns 3-4 and two rows, in board units of 100 per square.
  const x0 = 300;
  const y0 = top * 100;
  const w = 200;
  const h = 200;
  const merlons: { x: number; y: number }[] = [];
  for (let i = 0; i <= 8; i++) {
    merlons.push({ x: x0 + i * 25, y: y0 }, { x: x0 + i * 25, y: y0 + h });
    if (i > 0 && i < 8) merlons.push({ x: x0, y: y0 + i * 25 }, { x: x0 + w, y: y0 + i * 25 });
  }
  const tone = count === 0 ? 'ruin' : count === 1 ? 'danger' : 'ok';
  return (
    <svg viewBox="0 0 800 800" className={cx('pointer-events-none absolute inset-0 h-full w-full', tone === 'danger' && 'animate-check-pulse')} aria-hidden data-palace={color}>
      <rect
        x={x0}
        y={y0}
        width={w}
        height={h}
        fill={tone === 'danger' ? 'rgb(252 63 63 / 0.14)' : 'none'}
        stroke={tone === 'danger' ? 'var(--accent)' : 'var(--navy)'}
        strokeWidth={9}
        strokeDasharray={tone === 'ruin' ? '22 30' : undefined}
        opacity={tone === 'ruin' ? 0.45 : 0.9}
      />
      {tone !== 'ruin' &&
        merlons.map((m, i) => (
          <rect key={i} x={m.x - 6} y={m.y - 6} width={12} height={12} fill={tone === 'danger' ? 'var(--accent)' : 'var(--navy)'} rx={1.5} />
        ))}
    </svg>
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
