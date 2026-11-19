// The game's visual effects are started by events: the game screen works out
// what just happened (a move, a capture, check, the end of the game) and emits
// it here; the effects layer listens and draws. Display only: nothing here
// touches the game, the clocks or what is sent between players.

import type { Color, MoveInfo, Position } from '../chess/types';
import type { Result } from '../game/match';

export type FxEvent =
  | { t: 'start' }
  | {
      t: 'move';
      m: MoveInfo;
      /** The position after the move. */
      pos: Position;
      /** Squares of the pieces now giving check, and the checked king's square. */
      checkers: number[];
      king: number;
      /** This move ends the game by checkmate. */
      mate: boolean;
    }
  | { t: 'end'; result: Result; pos: Position; me: Color; afterMove: boolean };

type Listener = (e: FxEvent) => void;
const listeners = new Set<Listener>();

export function emitFx(e: FxEvent) {
  listeners.forEach((fn) => fn(e));
}

export function onFx(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** How long a piece takes to slide to its square (matches the board's CSS transition). */
export const SLIDE_MS = 150;
