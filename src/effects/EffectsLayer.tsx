import { useEffect, useRef, type RefObject } from 'react';
import { findKing } from '../chess/standard';
import { other, type Color, type Piece } from '../chess/types';
import { PIECE_VALUE } from '../lib/audio/sfx';
import { CREAM, INK, drawPiece } from '../board/pieceShapes';
import { SLIDE_MS, onFx, type FxEvent } from './fx';

// Standard Chess's effects (Caleb approved all of them in Stage 2), drawn on two
// canvases over the whole screen: one behind the board (the checkmate rays) and
// one in front (everything else). The screen shake moves `shakeRef`.

const RED = '#fc3f3f';
const SURFACE = '#fff8ee';

interface Fx {
  layer: 'back' | 'front';
  /** performance.now() when it starts. */
  start: number;
  life: number;
  draw(ctx: CanvasRenderingContext2D, age: number, k: number, W: number, H: number): void;
}

interface Geom {
  /** Inner board (inside the frame), in screen pixels. */
  x: number;
  y: number;
  size: number;
  sq: number;
  center(s: number): { x: number; y: number };
}

function boardGeom(): Geom | null {
  const el = document.querySelector<HTMLElement>('[data-board]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const border = 3;
  const x = r.left + border;
  const y = r.top + border;
  const size = r.width - border * 2;
  const sq = size / 8;
  const flip = el.dataset.board === 'b';
  return {
    x,
    y,
    size,
    sq,
    center(s) {
      const f = s & 7;
      const rk = s >> 3;
      const col = flip ? 7 - f : f;
      const row = flip ? rk : 7 - rk;
      return { x: x + (col + 0.5) * sq, y: y + (row + 0.5) * sq };
    },
  };
}

const easeOut = (k: number) => 1 - (1 - k) ** 3;
const fadeOut = (k: number, from = 0.6) => (k < from ? 1 : 1 - (k - from) / (1 - from));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Runs the effects. Mount once on the game screen. */
export function EffectsLayer({ shakeRef }: { shakeRef: RefObject<HTMLDivElement | null> }) {
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const list: Fx[] = [];
    let shake = 0;
    let raf = 0;
    let last = performance.now();
    void document.fonts?.load('80px Norwester').catch(() => {});

    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      for (const c of [back.current, front.current]) {
        if (!c) continue;
        c.width = Math.round(window.innerWidth * dpr);
        c.height = Math.round(window.innerHeight * dpr);
      }
    };
    size();
    window.addEventListener('resize', size);

    const add = (fx: Omit<Fx, 'start'> & { delay?: number }) => {
      list.push({ ...fx, start: performance.now() + (fx.delay ?? 0) });
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const kick = (amount: number, delay = 0) => {
      if (delay) window.setTimeout(() => kick(amount), delay);
      else {
        shake = Math.max(shake, amount);
        if (!raf) raf = requestAnimationFrame(frame);
      }
    };

    function frame(now: number) {
      raf = 0;
      const dt = Math.min(50, now - last);
      last = now;
      const dpr = window.devicePixelRatio || 1;
      const W = window.innerWidth;
      const H = window.innerHeight;
      for (const c of [back.current, front.current]) {
        const ctx = c?.getContext('2d');
        if (!ctx) continue;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
      }
      for (let i = list.length - 1; i >= 0; i--) {
        const fx = list[i];
        const age = now - fx.start;
        if (age < 0) continue;
        if (age >= fx.life) {
          list.splice(i, 1);
          continue;
        }
        const ctx = (fx.layer === 'back' ? back : front).current?.getContext('2d');
        if (!ctx) continue;
        ctx.save();
        fx.draw(ctx, age, age / fx.life, W, H);
        ctx.restore();
      }
      const el = shakeRef.current;
      if (el) {
        if (shake > 0.3) {
          el.style.transform = `translate(${rand(-1, 1) * shake}px, ${rand(-1, 1) * shake}px)`;
          shake *= Math.pow(0.85, dt / 16.7);
        } else {
          shake = 0;
          el.style.transform = '';
        }
      }
      if (list.length || shake > 0) raf = requestAnimationFrame(frame);
    }

    const off = onFx((e) => handle(e, add, kick));
    return () => {
      off();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      if (shakeRef.current) shakeRef.current.style.transform = '';
    };
  }, [shakeRef]);

  return (
    <>
      <canvas ref={back} className="pointer-events-none fixed inset-0 z-0 h-full w-full" aria-hidden />
      <canvas ref={front} className="pointer-events-none fixed inset-0 z-40 h-full w-full" aria-hidden />
    </>
  );
}

type Add = (fx: Omit<Fx, 'start'> & { delay?: number }) => void;
type Kick = (amount: number, delay?: number) => void;

function handle(e: FxEvent, add: Add, kick: Kick) {
  if (e.t === 'start') {
    // Not tied to the board (it may not be laid out yet on the first frame).
    banner(add, null, 0, 1000);
    return;
  }
  const g = boardGeom();
  if (e.t === 'end' && e.result.winner === null) banner(add, DRAW_BANNER[e.result.reason] ?? 'Draw', (e.afterMove ? SLIDE_MS + 260 : 0) + 300, 1800);
  if (!g) return;
  if (e.t === 'move') {
    const { m } = e;
    const to = g.center(m.to);
    if (m.castle) {
      // King and rook slide together with speed streaks.
      const r = m.from >> 3;
      const rookFrom = m.castle === 'k' ? r * 8 + 7 : r * 8;
      const rookTo = m.castle === 'k' ? r * 8 + 5 : r * 8 + 3;
      streaks(add, g, m.from, m.to);
      streaks(add, g, rookFrom, rookTo);
      ring(add, g, rookTo, SLIDE_MS);
      kick(3, SLIDE_MS);
    }
    if (m.captured && m.captureSq !== null) {
      // The captured piece stays until the attacker arrives, then shatters.
      const at = g.center(m.captureSq);
      const value = PIECE_VALUE[m.captured.kind];
      shatter(add, m.captured, at.x, at.y, g.sq, SLIDE_MS);
      spark(add, at.x, at.y, g.sq * (1 + value * 0.12), SLIDE_MS, RED);
      kick(3 + value * 1.6, SLIDE_MS);
    }
    ring(add, g, m.to, SLIDE_MS);
    if (m.promo) promotion(add, to.x, to.y, g, SLIDE_MS);
    if (e.checkers.length) {
      const king = g.center(e.king);
      for (const c of e.checkers) beam(add, g.center(c), king, g.sq, SLIDE_MS + 60);
      frameFlash(add, g, SLIDE_MS + 60);
      spark(add, king.x, king.y, g.sq * 1.1, SLIDE_MS + 160, RED);
      kick(5, SLIDE_MS + 160);
    }
    return;
  }
  // The end of the game.
  const { result, pos } = e;
  const delay = e.afterMove ? SLIDE_MS + 260 : 0;
  if (result.reason === 'checkmate' && result.winner) {
    const loser = other(result.winner);
    const k = g.center(findKing(pos, loser));
    killSpark(add, k.x, k.y, result.winner, delay);
    burst(add, k.x, k.y, g.sq, delay);
    kick(22, delay);
    banner(add, 'Checkmate', delay + 150, 1900);
  }
}

const DRAW_BANNER: Record<string, string> = {
  stalemate: 'Stalemate',
  repetition: 'Threefold repetition',
  fifty: 'Fifty-move rule',
  material: 'Insufficient material',
  agreement: 'Draw agreed',
  timeoutDraw: 'Out of time · Draw',
};

// ---------------------------------------------------------------- the effects

/** The captured piece: drawn whole until impact, a split-second freeze with a flash, then flat shards fly off and fall. */
function shatter(add: Add, piece: Piece, cx: number, cy: number, size: number, impact: number) {
  const dpr = window.devicePixelRatio || 1;
  const img = document.createElement('canvas');
  img.width = img.height = Math.ceil(size * dpr);
  const ictx = img.getContext('2d');
  if (!ictx) return;
  ictx.scale(dpr, dpr);
  drawPiece(ictx, piece.color, piece.kind, 0, 0, size);
  const ox = cx - size / 2;
  const oy = cy - size / 2;

  // Before impact: the piece where it stood (the board no longer shows it).
  add({ layer: 'front', life: impact, draw: (ctx) => ctx.drawImage(img, ox, oy, size, size) });

  // Shards: a jittered 4 x 4 grid, each cell split into two triangles.
  const n = 4;
  const cell = size / n;
  const pts: { x: number; y: number }[][] = [];
  for (let i = 0; i <= n; i++) {
    pts.push([]);
    for (let j = 0; j <= n; j++) {
      const edge = i === 0 || j === 0 || i === n || j === n;
      pts[i].push({ x: j * cell + (edge ? 0 : rand(-0.3, 0.3) * cell), y: i * cell + (edge ? 0 : rand(-0.3, 0.3) * cell) });
    }
  }
  const shards: { v: { x: number; y: number }[]; c: { x: number; y: number }; vx: number; vy: number; spin: number }[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const a = pts[i][j];
      const b = pts[i][j + 1];
      const c = pts[i + 1][j + 1];
      const d = pts[i + 1][j];
      const tris = Math.random() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      for (const t of tris) {
        const cen = { x: (t[0].x + t[1].x + t[2].x) / 3, y: (t[0].y + t[1].y + t[2].y) / 3 };
        const dx = (cen.x - size / 2) / (size / 2);
        const dy = (cen.y - size / 2) / (size / 2);
        shards.push({
          v: t.map((p) => ({ x: p.x - cen.x, y: p.y - cen.y })),
          c: cen,
          vx: dx * size * rand(4, 9) + rand(-1, 1) * size,
          vy: dy * size * rand(3, 6) - size * rand(5, 10),
          spin: rand(-14, 14),
        });
      }
    }
  const FREEZE = 90;
  const gravity = size * 30;
  add({
    layer: 'front',
    delay: impact,
    life: 1300,
    draw(ctx, age, k) {
      const t = Math.max(0, age - FREEZE) / 1000;
      ctx.globalAlpha = fadeOut(k, 0.55);
      for (const s of shards) {
        ctx.save();
        ctx.translate(ox + s.c.x + s.vx * t, oy + s.c.y + s.vy * t + 0.5 * gravity * t * t);
        ctx.rotate(s.spin * t);
        ctx.beginPath();
        ctx.moveTo(s.v[0].x, s.v[0].y);
        ctx.lineTo(s.v[1].x, s.v[1].y);
        ctx.lineTo(s.v[2].x, s.v[2].y);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, -s.c.x, -s.c.y, size, size);
        ctx.restore();
      }
      // The freeze-frame: a hard flash over the piece at the moment of impact.
      if (age < FREEZE + 40) {
        ctx.globalAlpha = 1 - age / (FREEZE + 40);
        ctx.fillStyle = SURFACE;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.62, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  });
}

/** A star-burst: rays thrown out from a point. */
function spark(add: Add, cx: number, cy: number, size: number, delay: number, color: string) {
  const rays = 12;
  const offs = Array.from({ length: rays }, () => rand(0.75, 1.25));
  add({
    layer: 'front',
    delay,
    life: 420,
    draw(ctx, _age, k) {
      const r = size * (0.35 + 0.95 * easeOut(k));
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineWidth = size * 0.09 * (1 - k);
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        const r0 = r * 0.45;
        const r1 = r * offs[i];
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = size * 0.04 * (1 - k);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    },
  });
}

/** An ink ring where a piece lands. */
function ring(add: Add, g: Geom, s: number, delay: number) {
  const { x, y } = g.center(s);
  add({
    layer: 'front',
    delay,
    life: 380,
    draw(ctx, _age, k) {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = INK;
      ctx.lineWidth = g.sq * 0.07 * (1 - k * 0.7);
      ctx.beginPath();
      ctx.arc(x, y, g.sq * (0.3 + 0.38 * easeOut(k)), 0, Math.PI * 2);
      ctx.stroke();
    },
  });
}

/** Speed lines along a slide. */
function streaks(add: Add, g: Geom, from: number, to: number) {
  const a = g.center(from);
  const b = g.center(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  add({
    layer: 'front',
    life: 420,
    draw(ctx, age, k) {
      const p = Math.min(1, age / SLIDE_MS);
      ctx.lineCap = 'round';
      [-0.28, 0, 0.28].forEach((o, i) => {
        ctx.globalAlpha = (1 - k) * (i === 1 ? 0.9 : 0.6);
        ctx.strokeStyle = i === 1 ? RED : INK;
        ctx.lineWidth = g.sq * (i === 1 ? 0.07 : 0.04);
        const ox = nx * o * g.sq;
        const oy = ny * o * g.sq;
        const tail = Math.max(0, p - 0.65 - k * 0.5);
        ctx.beginPath();
        ctx.moveTo(a.x + (b.x - a.x) * tail + ox, a.y + (b.y - a.y) * tail + oy);
        ctx.lineTo(a.x + (b.x - a.x) * p + ox, a.y + (b.y - a.y) * p + oy);
        ctx.stroke();
      });
    },
  });
}

/** Check: a red line shoots from the checking piece to the king. */
function beam(add: Add, from: { x: number; y: number }, to: { x: number; y: number }, sq: number, delay: number) {
  add({
    layer: 'front',
    delay,
    life: 900,
    draw(ctx, age, k) {
      const p = Math.min(1, age / 130);
      ctx.globalAlpha = fadeOut(k, 0.45);
      ctx.strokeStyle = RED;
      ctx.lineCap = 'round';
      ctx.shadowColor = RED;
      ctx.shadowBlur = sq * 0.5;
      ctx.lineWidth = sq * 0.14 * (1 - k * 0.6);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = SURFACE;
      ctx.lineWidth = sq * 0.04 * (1 - k);
      ctx.stroke();
    },
  });
}

/** Check: the board's frame flashes red. */
function frameFlash(add: Add, g: Geom, delay: number) {
  add({
    layer: 'front',
    delay,
    life: 650,
    draw(ctx, _age, k) {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = RED;
      ctx.lineWidth = 6 + 10 * (1 - k);
      ctx.strokeRect(g.x - 4, g.y - 4, g.size + 8, g.size + 8);
    },
  });
}

/**
 * Promotion: a column of stripes rises around the pawn, then the new piece
 * bursts out. Promotions happen on the far edge of the board, so the stripes
 * come up from below the square and end at the top of it.
 */
function promotion(add: Add, cx: number, cy: number, g: Geom, delay: number) {
  const below = cy < g.y + g.size / 2 ? 1 : -1;
  add({
    layer: 'front',
    delay,
    life: 900,
    draw(ctx, _age, k) {
      const rise = easeOut(Math.min(1, k / 0.55));
      const reach = g.sq * 3.4;
      const top = cy - below * g.sq * 0.45;
      const tail = top + below * reach * (1 - 0.75 * rise);
      const head = top + below * reach * (1 - rise);
      ctx.globalAlpha = fadeOut(k, 0.5);
      const w = g.sq * 0.11;
      [
        [-0.42, INK, 0],
        [-0.2, RED, 0.25],
        [0.2, RED, 0.25],
        [0.42, INK, 0],
      ].forEach(([dx, col, lag]) => {
        ctx.fillStyle = col as string;
        const y0 = Math.min(head, tail) + (lag as number) * g.sq * below;
        ctx.fillRect(cx + (dx as number) * g.sq - w / 2, y0, w, Math.abs(tail - head));
      });
      ctx.globalAlpha = 0.5 * (1 - k);
      ctx.fillStyle = SURFACE;
      ctx.beginPath();
      ctx.arc(cx, cy, g.sq * 0.55, 0, Math.PI * 2);
      ctx.fill();
    },
  });
  spark(add, cx, cy, g.sq * 1.4, delay + 420, RED);
  spark(add, cx, cy, g.sq * 1.0, delay + 470, INK);
}

/** Checkmate: rays in the winner's color and red flood the whole screen behind the board. */
function killSpark(add: Add, cx: number, cy: number, winner: Color, delay: number) {
  const win = winner === 'w' ? CREAM : INK;
  add({
    layer: 'back',
    delay,
    life: 2200,
    draw(ctx, age, k, W, H) {
      ctx.globalAlpha = k < 0.05 ? k / 0.05 : fadeOut(k, 0.55);
      ctx.fillStyle = RED;
      ctx.fillRect(0, 0, W, H);
      const R = Math.hypot(W, H);
      const n = 18;
      const turn = age * 0.00025;
      ctx.fillStyle = win;
      for (let i = 0; i < n; i++) {
        const a0 = turn + (i / n) * Math.PI * 2;
        const a1 = a0 + (Math.PI * 2) / n / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
        ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
        ctx.closePath();
        ctx.fill();
      }
    },
  });
}

/** Checkmate: a big ring and burst at the mated king. */
function burst(add: Add, cx: number, cy: number, sq: number, delay: number) {
  add({
    layer: 'front',
    delay,
    life: 800,
    draw(ctx, _age, k) {
      const r = sq * (0.5 + 3.5 * easeOut(k));
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = INK;
      ctx.lineWidth = sq * 0.3 * (1 - k);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = SURFACE;
      ctx.lineWidth = sq * 0.12 * (1 - k);
      ctx.stroke();
    },
  });
  spark(add, cx, cy, sq * 2.2, delay, RED);
}

/**
 * The Portal's staggered stripes sweep across the screen, with a word on the
 * navy band (or no word: the game-start sweep).
 */
function banner(add: Add, text: string | null, delay: number, life: number) {
  add({
    layer: 'front',
    delay,
    life,
    draw(ctx, age, _k, W, H) {
      const IN = 260;
      const OUT = 280;
      const band = text ? Math.min(H * 0.15, W * 0.16) : Math.min(H * 0.05, 34);
      const bar = band * (text ? 0.16 : 0.45);
      const gap = bar * 0.7;
      const cy = H / 2;
      // Each bar slides in from the left a little after the one before, and out to the right.
      const pos = (lag: number) => {
        const a = age - lag;
        if (a < IN) return -W + W * easeOut(Math.max(0, a) / IN);
        if (a > life - OUT - 60 + lag) return W * easeOut(Math.min(1, (a - (life - OUT - 60)) / OUT));
        return 0;
      };
      const rows: [number, number, string, number][] = text
        ? [
            [cy - band / 2 - gap - bar, bar, RED, 0.62],
            [cy - band / 2, band, INK, 1],
            [cy + band / 2 + gap, bar, RED, 0.8],
            [cy + band / 2 + gap * 2 + bar, bar, INK, 0.45],
          ]
        : [
            [cy - bar * 1.5 - gap, bar, INK, 0.91],
            [cy - bar / 2, bar, RED, 0.5],
            [cy + bar / 2 + gap, bar, INK, 0.72],
          ];
      rows.forEach(([y, h, col, len], i) => {
        const x = pos(i * 40);
        ctx.fillStyle = col;
        // Staggered lengths, flush to the left edge as the Portal's top stripes are.
        ctx.fillRect(x, y, W * len, h);
      });
      if (text) {
        const x = pos(40);
        ctx.fillStyle = SURFACE;
        ctx.font = `400 ${Math.round(band * 0.62)}px Norwester, 'Archivo Variable', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(band * 0.04)}px`;
        let size = band * 0.62;
        while (ctx.measureText(text.toUpperCase()).width > W * 0.9 && size > 10) {
          size *= 0.9;
          ctx.font = `400 ${Math.round(size)}px Norwester, 'Archivo Variable', sans-serif`;
        }
        ctx.fillText(text.toUpperCase(), W / 2 + x, cy + band * 0.04);
      }
    },
  });
}

