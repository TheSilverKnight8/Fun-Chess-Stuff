// Runs the CPU's thinking off the main thread, so the board and effects stay smooth.

import { think, type Level } from './brain';
import type { Color, Position } from '../chess/types';

self.onmessage = (e: MessageEvent<{ id: number; pos: Position; level: Level; cpu: Color }>) => {
  const { id, pos, level, cpu } = e.data;
  let action = null;
  try {
    action = think(pos, level, cpu);
  } catch {
    action = null;
  }
  (self as unknown as Worker).postMessage({ id, action });
};
