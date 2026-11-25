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
// Stage 7 (Caleb): slower and more telegraphed: the die lands, its verdict is shown, then the file and rank dice roll.
export const ROLL = { dieStart: SLIDE_MS + 150, dieLand: SLIDE_MS + 1050, d8Start: SLIDE_MS + 2050, d8Land: SLIDE_MS + 2850, cross: SLIDE_MS + 3000, reroll: 1300, open: SLIDE_MS + 3500 };

/** When the pothole cracks open, or null if none opens. */
export const openAt = (roll: Roll) => (roll.opened === null ? null : ROLL.open + (roll.tries.length - 1) * ROLL.reroll);

/** Mega Knight: when a leaping mega knight lands (it moves over 0.9 s on the board). */
export const MK_LAND = 900;

/** Mega Knight's roll (Stage 7: slower): the die lands, then its verdict holds. */
export const MK_ROLL = { land: 900, hold: 2300 };
/** Remorse's capture roll (Stage 7: slower): the die over the piece lands, then the status word rises. */
export const REMORSE_ROLL = { start: SLIDE_MS + 200, land: SLIDE_MS + 1000, word: SLIDE_MS + 1300 };

/**
 * Revival (Stage 7: slower, and in step): the move slides first; then for each
 * piece changing boards the view turns to its board if needed, it leaves, the
 * view turns to the other board (the old board goes out, the new one comes in),
 * and it arrives. A piece arriving stays hidden until its beam lands.
 */
export const REVIVAL = { lead: SLIDE_MS + 300, flipOut: 600, flipIn: 750, leave: 1000, settle: 200, enter: 1000, reveal: 380, back: 600 };
export const FLIP_MS = REVIVAL.flipOut + REVIVAL.flipIn;

/** Revival: how long a set of board changes takes to show (at most two flips each, plus the flip back). */
export function revivalMs(transfers: { gone?: boolean; to: unknown }[]) {
  if (!transfers.length) return 0;
  let t = REVIVAL.lead;
  for (const tr of transfers) {
    t += FLIP_MS + REVIVAL.leave;
    if (tr.gone) continue;
    t += FLIP_MS + REVIVAL.settle + (tr.to ? REVIVAL.enter : 300);
  }
  return t + REVIVAL.back + FLIP_MS;
}

/** How long the effects of the last action take to show, so the CPU waits for them before it replies. */
export function effectsMs(m: { roll: Roll | null; remorse: RemorseEvent | null; mkRoll: unknown; transfers: { gone?: boolean; to: unknown }[]; rental: RentalEvent | null }) {
  let t = 0;
  if (m.roll) t = Math.max(t, openAt(m.roll) ?? ROLL.dieLand + 1500);
  if (m.mkRoll) t = Math.max(t, MK_ROLL.hold);
  if (m.remorse) t = Math.max(t, m.remorse.d6 !== null ? REMORSE_ROLL.word + 900 : 1200);
  if (m.rental) t = Math.max(t, 1500);
  return Math.max(t, revivalMs(m.transfers));
}
