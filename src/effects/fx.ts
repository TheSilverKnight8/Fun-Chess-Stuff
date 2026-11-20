// The game's visual effects are started by events: the game screen works out
// what just happened (a move, a capture, check, the end of the game) and emits
// it here; the effects layer listens and draws. Display only: nothing here
// touches the game, the clocks or what is sent between players.

import type { Color, MoveInfo, Piece, Position } from '../chess/types';
import type { Result } from '../game/match';
import type { Roll } from '../chess/pothole';
import type { RemorseEvent } from '../chess/remorse';
import type { RentalEvent } from '../chess/rental';

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
      /** Remorse: this was a psychopath's extra move. */
      extraMove?: boolean;
    }
  | { t: 'mkroll'; d6: number }
  | { t: 'formed'; anchors: number[] }
  | { t: 'remorse'; ev: RemorseEvent }
  /** Bario: a side's cycle ended; these squares' Quantums turned undefined again. */
  | { t: 'cycle'; squares: number[] }
  /** Revival: a piece leaving a board, arriving on one, or gone for good. */
  | { t: 'leave'; piece: Piece; sq: number; board: 'main' | 'aux' }
  | { t: 'enter'; piece: Piece; sq: number; board: 'main' | 'aux' }
  | { t: 'gone'; piece: Piece; sq: number; board: 'main' | 'aux' }
  /** Rental: money moved. `me` tells which side of the board is whose. */
  | { t: 'rental'; ev: RentalEvent; me: Color; squares: number[]; payer: Color | null }
  | { t: 'roll'; roll: Roll }
  | { t: 'end'; result: Result; pos: Position; me: Color; afterMove: boolean; extraDelay: number };

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

/**
 * Pot-Hole's dice, in ms after the roll is shown: the six-sided die tumbles in
 * and lands; on an even roll two eight-sided dice pick the file and rank and a
 * crosshair drops on the square (again for each re-roll off a king); then the
 * square cracks open.
 */
export const ROLL = { dieStart: SLIDE_MS + 100, dieLand: SLIDE_MS + 550, d8Start: SLIDE_MS + 700, d8Land: SLIDE_MS + 1050, cross: SLIDE_MS + 1100, reroll: 700, open: SLIDE_MS + 1300 };

/** When the pothole cracks open, or null if none opens. */
export const openAt = (roll: Roll) => (roll.opened === null ? null : ROLL.open + (roll.tries.length - 1) * ROLL.reroll);

/** Mega Knight: when a leaping mega knight lands (it moves over 0.5 s on the board). */
export const MK_LAND = 480;
