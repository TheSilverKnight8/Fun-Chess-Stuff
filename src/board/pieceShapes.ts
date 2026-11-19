// The pieces: classic Staunton outlines drawn in the Engineering Portal's
// manner (flat fills, rounded navy outlines, a few inner construction lines).
// White pieces are cream with navy lines; Black pieces are navy with cream
// inner lines and a thin cream edge. Drawn on a 100 x 100 grid, standing on a plinth at the bottom.

import type { Color, Kind } from '../chess/types';

// Each piece is a list of parts:
//   body:   filled with the piece color, navy outline
//   line:   an inner line in the contrast color (navy on White, cream on Black)
//   dot:    a small filled mark in the contrast color
export type Part = { t: 'body' | 'line'; d: string } | { t: 'dot'; cx: number; cy: number; r: number };

const plinth: Part = { t: 'body', d: 'M22 89h56a3 3 0 0 0 3-3v-3a5 5 0 0 0-5-5H24a5 5 0 0 0-5 5v3a3 3 0 0 0 3 3z' };

export const ART: Record<Kind, Part[]> = {
  P: [
    plinth,
    { t: 'body', d: 'M30 78c3-9 8-14 11-19h18c3 5 8 10 11 19z' },
    { t: 'body', d: 'M35 52h30a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H35a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3z' },
    { t: 'body', d: 'M50 24a14 14 0 1 1 0 28a14 14 0 1 1 0-28z' },
    { t: 'line', d: 'M38 71h24' },
  ],
  R: [
    plinth,
    { t: 'body', d: 'M29 78l4-8 2-26h30l2 26 4 8z' },
    { t: 'body', d: 'M30 44h40a2 2 0 0 0 2-2v-3H28v3a2 2 0 0 0 2 2z' },
    { t: 'body', d: 'M26 39V17h11v7h7.5v-7h11v7H63v-7h11v22z' },
    { t: 'line', d: 'M36 52h28M35 63h30' },
  ],
  N: [
    plinth,
    {
      t: 'body',
      d: 'M29 78c1-10 6-17 13-23-5 2-10 3-15 2-5-1-9-5-8-10 0-4 4-7 8-10 6-5 10-11 13-18l3-9 5 7 4-6 3 9c11 6 18 18 19 33 1 11-1 19-3 25z',
    },
    { t: 'line', d: 'M58 16c9 7 13 19 13 33M45 47c-2 4-2 7 0 9' },
    { t: 'dot', cx: 41, cy: 31, r: 3 },
    { t: 'dot', cx: 24, cy: 46, r: 1.8 },
  ],
  B: [
    plinth,
    { t: 'body', d: 'M30 78c4-8 9-13 11-18h18c2 5 7 10 11 18z' },
    { t: 'body', d: 'M34 53h32a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H34a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3z' },
    { t: 'body', d: 'M50 15c-11 9-17 19-17 27 0 7 7 11 17 11s17-4 17-11c0-8-6-18-17-27z' },
    { t: 'body', d: 'M50 6a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9z' },
    { t: 'line', d: 'M58 27l-9 11M38 71h24' },
  ],
  Q: [
    plinth,
    { t: 'body', d: 'M28 78c5-10 9-20 11-31h22c2 11 6 21 11 31z' },
    { t: 'body', d: 'M36 41h28a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H36a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3z' },
    { t: 'body', d: 'M35 41l-8-21 13 9 4-16 6 14 6-14 4 16 13-9-8 21z' },
    { t: 'body', d: 'M27 14.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM44 7.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM56 7.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM73 14.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8z' },
    { t: 'line', d: 'M37 70h26M40 59h20' },
  ],
  K: [
    plinth,
    { t: 'body', d: 'M28 78c5-10 9-20 11-31h22c2 11 6 21 11 31z' },
    { t: 'body', d: 'M36 41h28a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H36a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3z' },
    { t: 'body', d: 'M36 41c-4-6-4-13 1-17 4-3 9-3 13 1 4-4 9-4 13-1 5 4 5 11 1 17z' },
    { t: 'body', d: 'M47 3h6v6h6v6h-6v9h-6v-9h-6V9h6z' },
    { t: 'line', d: 'M37 70h26M40 59h20' },
  ],
};

export const INK = '#002657';
export const CREAM = '#faeeda';
export const WHITE_FILL = '#fff8ee';

const paths = new Map<string, Path2D>();
const path = (d: string) => {
  let p = paths.get(d);
  if (!p) paths.set(d, (p = new Path2D(d)));
  return p;
};

/** Draws a piece on a canvas, the same drawing as PieceArt, filling a size x size box at (x, y). */
export function drawPiece(ctx: CanvasRenderingContext2D, color: Color, kind: Kind, x: number, y: number, size: number) {
  const parts = ART[kind];
  const white = color === 'w';
  const line = white ? INK : CREAM;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of parts) {
    if (p.t !== 'body') continue;
    ctx.fillStyle = white ? WHITE_FILL : INK;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.2;
    ctx.fill(path(p.d));
    ctx.stroke(path(p.d));
  }
  if (!white)
    for (const p of parts) {
      if (p.t !== 'body') continue;
      ctx.fillStyle = INK;
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 1.5;
      ctx.fill(path(p.d));
      ctx.stroke(path(p.d));
    }
  for (const p of parts) {
    if (p.t === 'dot') {
      ctx.fillStyle = line;
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.t === 'line') {
      ctx.strokeStyle = line;
      ctx.lineWidth = 2.6;
      ctx.stroke(path(p.d));
    }
  }
  ctx.restore();
}
