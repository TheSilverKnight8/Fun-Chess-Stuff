// The pieces as SVG. The drawings themselves are in pieceShapes.ts (shared with the effects canvas).

import type { Color, Kind } from '../chess/types';
import { ART, CREAM, INK, WHITE_FILL } from './pieceShapes';

export function PieceArt({ color, kind, className }: { color: Color; kind: Kind; className?: string }) {
  const parts = ART[kind];
  const white = color === 'w';
  const line = white ? INK : CREAM;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <g strokeLinecap="round" strokeLinejoin="round">
        {parts.map((p, i) => (p.t === 'body' ? <path key={i} d={p.d} fill={white ? WHITE_FILL : INK} stroke={INK} strokeWidth={4.2} /> : null))}
        {/* Black pieces: a thin cream line just inside the navy edge of every part, so the parts read apart. */}
        {!white && parts.map((p, i) => (p.t === 'body' ? <path key={`e${i}`} d={p.d} fill={INK} stroke={CREAM} strokeWidth={1.5} /> : null))}
        {parts.map((p, i) =>
          p.t === 'dot' ? (
            <circle key={`d${i}`} cx={p.cx} cy={p.cy} r={p.r} fill={line} />
          ) : p.t === 'line' ? (
            <path key={`l${i}`} d={p.d} fill="none" stroke={line} strokeWidth={2.6} />
          ) : null,
        )}
      </g>
    </svg>
  );
}
