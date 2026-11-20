import { useEffect, useRef, useState } from 'react';
import { PieceArt } from '../board/PieceArt';
import type { Color, Kind } from '../chess/types';
import { cx } from '../components/ui';

// A small animated board for the guidebook: it plays a short scripted scene
// (pieces moving, captures, highlights, dice, potholes, captions) and loops.
// Scenes are written in guides.ts. Display only; it does not use the rules engine.

/** A piece as written in a scene: color + kind + square, e.g. "wKe1", "bPe7". */
export type Placement = string;

export type Step =
  | { t: 'move'; from: string; to: string; promo?: Kind }
  /** Highlights squares: dots for legal moves, red for danger, navy for emphasis. */
  | { t: 'mark'; squares: string[]; tone?: 'dot' | 'danger' | 'good' }
  | { t: 'clear' }
  | { t: 'remove'; sq: string }
  | { t: 'add'; piece: Placement }
  | { t: 'hole'; sq: string | null; turns?: number }
  | { t: 'die'; value: number | null }
  | { t: 'caption'; text: string }
  /** A small label over a square (Remorse statuses), or null to clear. */
  | { t: 'tag'; sq: string; text: string | null; tone?: 'red' | 'navy' }
  /** Tips a king over (checkmate, resignation, a crushed king). */
  | { t: 'fall'; sq: string }
  /** Mega Knight: where the mega knights are (lower-left squares). */
  | { t: 'mk'; at: string[] }
  | { t: 'wait'; ms: number };

export interface Scene {
  /** Pieces at the start of the scene. */
  setup: Placement[];
  steps: Step[];
  /** Draw Bastille's palace walls. */
  palaces?: boolean;
  /** Mega knights at the start (lower-left squares). */
  mk?: string[];
  /** Show the board from Black's side. */
  flip?: boolean;
  /** Show only some ranks (bottom..top, 1-8), to keep small scenes compact. */
  ranks?: [number, number];
}

interface P {
  id: number;
  color: Color;
  kind: Kind;
  sq: number;
  gone: boolean;
  fallen: boolean;
}

const sqOf = (n: string) => 'abcdefgh'.indexOf(n[0]) + (Number(n[1]) - 1) * 8;
const parse = (s: Placement, id: number): P => ({ id, color: s[0] as Color, kind: s[1] as Kind, sq: sqOf(s.slice(2)), gone: false, fallen: false });

const STEP_MS = 900;

export function GuideBoard({ scene, className }: { scene: Scene; className?: string }) {
  const [pieces, setPieces] = useState<P[]>(() => scene.setup.map(parse));
  const [marks, setMarks] = useState<{ sq: number; tone: 'dot' | 'danger' | 'good' }[]>([]);
  const [hole, setHole] = useState<{ sq: number; turns: number } | null>(null);
  const [die, setDie] = useState<number | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [tags, setTags] = useState<Record<number, { text: string; tone: 'red' | 'navy' }>>({});
  const [last, setLast] = useState<[number, number] | null>(null);
  const [mk, setMk] = useState<number[]>(() => (scene.mk ?? []).map(sqOf));
  const nextId = useRef(1000);

  useEffect(() => {
    let i = 0;
    let timer: number;
    let alive = true;
    const reset = () => {
      setPieces(scene.setup.map(parse));
      setMarks([]);
      setHole(null);
      setDie(null);
      setCaption(null);
      setTags({});
      setLast(null);
      setMk((scene.mk ?? []).map(sqOf));
    };
    const run = () => {
      if (!alive) return;
      if (i >= scene.steps.length) {
        i = 0;
        timer = window.setTimeout(() => {
          reset();
          timer = window.setTimeout(run, 700);
        }, 1600);
        return;
      }
      const s = scene.steps[i++];
      let wait = STEP_MS;
      switch (s.t) {
        case 'move': {
          const from = sqOf(s.from);
          const to = sqOf(s.to);
          setPieces((ps) =>
            ps.map((p) => {
              if (p.gone) return p;
              if (p.sq === to && p.sq !== from) return { ...p, gone: true };
              if (p.sq === from) return { ...p, sq: to, kind: s.promo ?? p.kind };
              return p;
            }),
          );
          setTags((t) => {
            const n = { ...t };
            delete n[to];
            if (n[from]) {
              n[to] = n[from];
              delete n[from];
            }
            return n;
          });
          setLast([from, to]);
          setMarks([]);
          break;
        }
        case 'mark':
          setMarks(s.squares.map((q) => ({ sq: sqOf(q), tone: s.tone ?? 'dot' })));
          wait = 1100;
          break;
        case 'clear':
          setMarks([]);
          wait = 200;
          break;
        case 'remove':
          setPieces((ps) => ps.map((p) => (!p.gone && p.sq === sqOf(s.sq) ? { ...p, gone: true } : p)));
          break;
        case 'add':
          setPieces((ps) => [...ps, parse(s.piece, nextId.current++)]);
          break;
        case 'hole':
          setHole(s.sq ? { sq: sqOf(s.sq), turns: s.turns ?? 0 } : null);
          break;
        case 'die':
          setDie(s.value);
          wait = s.value === null ? 200 : 1000;
          break;
        case 'caption':
          setCaption(s.text);
          wait = 300;
          break;
        case 'tag':
          setTags((t) => {
            const n = { ...t };
            if (s.text === null) delete n[sqOf(s.sq)];
            else n[sqOf(s.sq)] = { text: s.text, tone: s.tone ?? 'red' };
            return n;
          });
          wait = 700;
          break;
        case 'fall':
          setPieces((ps) => ps.map((p) => (!p.gone && p.sq === sqOf(s.sq) ? { ...p, fallen: true } : p)));
          break;
        case 'wait':
          wait = s.ms;
          break;
        case 'mk':
          setMk(s.at.map(sqOf));
          wait = 1000;
          break;
      }
      timer = window.setTimeout(run, wait);
    };
    reset();
    timer = window.setTimeout(run, 900);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [scene]);

  const [r0, r1] = scene.ranks ?? [1, 8];
  const rows = r1 - r0 + 1;
  const flip = !!scene.flip;
  const place = (s: number) => {
    const f = s & 7;
    const r = (s >> 3) + 1;
    return { col: flip ? 7 - f : f, row: flip ? r - r0 : r1 - r };
  };
  const inView = (s: number) => {
    const r = (s >> 3) + 1;
    return r >= r0 && r <= r1;
  };
  const cell = (s: number) => {
    const { col, row } = place(s);
    return { left: `${col * 12.5}%`, top: `${(row * 100) / rows}%`, width: '12.5%', height: `${100 / rows}%` };
  };

  return (
    <div className={cx('w-full', className)}>
      <div className="relative w-full overflow-hidden rounded-md border-[3px] border-navy bg-[var(--sq-light)]" style={{ aspectRatio: `8 / ${rows}` }}>
        {Array.from({ length: 64 }, (_, s) => s)
          .filter(inView)
          .map((s) => {
            const light = ((s & 7) + (s >> 3)) % 2 === 1;
            const isLast = last && (last[0] === s || last[1] === s);
            const m = marks.find((x) => x.sq === s);
            return (
              <div key={s} className="absolute" style={{ ...cell(s), background: light ? 'var(--sq-light)' : 'var(--sq-dark)' }}>
                {isLast && <div className="absolute inset-0 bg-[var(--sq-last)]" />}
                {m?.tone === 'danger' && <div className="absolute inset-0 animate-check-pulse bg-accent/45" />}
                {m?.tone === 'good' && <div className="absolute inset-0 border-[3px] border-navy bg-navy/15" />}
                {m?.tone === 'dot' && <div className="absolute left-1/2 top-1/2 h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-navy/45" />}
              </div>
            );
          })}
        {scene.palaces &&
          (['w', 'b'] as const).map((c) => {
            const top = c === 'w' ? place(sqOf('d2')).row : place(sqOf('d8')).row;
            if (top < 0 || top + 1 >= rows + 1) return null;
            return <div key={c} className="pointer-events-none absolute border-[3px] border-dashed border-navy" style={{ left: '37.5%', width: '25%', top: `${(top * 100) / rows}%`, height: `${200 / rows}%` }} />;
          })}
        {hole && inView(hole.sq) && (
          <div className="absolute animate-pop p-[6%]" style={cell(hole.sq)}>
            <div className="relative h-full w-full rounded-[30%] border-4 border-[#6b5640] bg-[#0b1626]">
              {hole.turns > 0 && (
                <div className="absolute inset-x-0 bottom-[8%] flex justify-center gap-[8%]">
                  {Array.from({ length: hole.turns }, (_, i) => (
                    <span key={i} className="block aspect-square w-[14%] rounded-full bg-[var(--sq-light)]" />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {mk.map((a, i) => {
          const c1 = place(a);
          const c2 = place(a + 9);
          return (
            <div key={`mk${i}`} className="pointer-events-none absolute z-[1] transition-all duration-500 ease-out" style={{ left: `${Math.min(c1.col, c2.col) * 12.5}%`, top: `${(Math.min(c1.row, c2.row) * 100) / rows}%`, width: '25%', height: `${200 / rows}%` }}>
              <PieceArt color="w" kind="N" className="h-full w-full [filter:sepia(1)_saturate(6)_hue-rotate(-30deg)]" />
            </div>
          );
        })}
        {pieces.map((p) =>
          inView(p.sq) ? (
            <div
              key={p.id}
              className={cx('pointer-events-none absolute transition-all duration-300 ease-out', p.gone && 'scale-50 opacity-0')}
              style={{ ...cell(p.sq), transitionProperty: 'left, top, opacity, transform' }}
            >
              <div className={cx('h-full w-full', p.fallen && 'animate-topple')}>
                <PieceArt color={p.color} kind={p.kind} className="h-full w-full" />
              </div>
            </div>
          ) : null,
        )}
        {Object.entries(tags).map(([s, t]) => (
          <div key={`tag${s}`} className="pointer-events-none absolute flex items-start justify-center" style={cell(Number(s))}>
            <span className={cx('-mt-[10%] animate-pop rounded px-1 font-display text-[clamp(7px,1.6vw,11px)] uppercase leading-tight text-on-accent', t.tone === 'navy' ? 'bg-navy' : 'bg-accent')}>
              {t.text}
            </span>
          </div>
        ))}
        {die !== null && (
          <div className="absolute right-[3%] top-[6%] flex aspect-square w-[14%] animate-pop items-center justify-center rounded-[18%] border-[3px] border-navy bg-surface font-display text-[clamp(14px,3vw,26px)] text-ink">
            {die}
          </div>
        )}
      </div>
      <p className="mt-2 min-h-[2.75rem] text-sm text-ink">{caption}</p>
    </div>
  );
}
