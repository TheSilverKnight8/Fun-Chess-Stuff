// Rental Chess (inspired by Ralph Betza; spec 7.6, Caleb's rules). Each side
// has a treasury. Each turn, in order: receive income (3 per unit, king
// included), make a legal move, pay rent for the squares your pieces stand on
// (edge squares 1, the centre four 4, all others 2, each +1 for every 5 full
// rounds played). If the rent cannot be paid, the player gives up units of
// their choice until it can; having to give up the king is bankruptcy.

import { fileOf, other, rankOf, type Color, type Piece, type Position } from './types';

export const INCOME_PER_UNIT = 3;

/** A square's base rent. */
export function squareRent(s: number) {
  const f = fileOf(s);
  const r = rankOf(s);
  if (f === 0 || f === 7 || r === 0 || r === 7) return 1;
  if ((f === 3 || f === 4) && (r === 3 || r === 4)) return 4;
  return 2;
}

/** The rise in every square's rent: +1 for every 5 full rounds (both players have moved) played. */
export const rentRise = (roundsDone: number) => Math.floor(roundsDone / 5);

export const units = (pos: Position, c: Color) => pos.board.filter((p) => p?.color === c).length;

export function rentFor(pos: Position, c: Color, roundsDone: number) {
  const rise = rentRise(roundsDone);
  let total = 0;
  pos.board.forEach((p, s) => {
    if (p?.color === c) total += squareRent(s) + rise;
  });
  return total;
}

const kingsOnly = (pos: Position) => pos.board.every((p) => !p || p.kind === 'K');
const plyOf = (pos: Position) => (pos.fullmove - 1) * 2 + (pos.turn === 'b' ? 1 : 0);

/** What happened to the money this turn, for the screens to show. */
export interface RentalEvent {
  ply: number;
  /** Rent paid and by whom (null while it is still owed). */
  paid: { color: Color; amount: number } | null;
  /** Income received by the player whose turn begins. */
  income: { color: Color; amount: number } | null;
  /** Rent the mover could not pay (they now give up units). */
  owed: number | null;
  /** A unit given up to pay rent. */
  evicted: { sq: number; piece: Piece } | null;
  /** The rise per square after this payment, when it just went up. */
  riseNow: number | null;
}

/** The start: White receives its first income before its first move (Betza's order, from move one). */
export function rentalStart(pos: Position): Position {
  return { ...pos, rental: { treasury: { w: INCOME_PER_UNIT * units(pos, 'w'), b: 0 }, owed: null } };
}

/**
 * After a move: the mover pays rent for where their pieces now stand. If they
 * can, the turn passes and the other player receives their income. If not, the
 * turn stays with them, with the rent owed, until they give up enough units.
 * `prev` is the position before the move.
 */
export function rentalAfterMove(prev: Position, pos: Position): { pos: Position; ev: RentalEvent } {
  const mover = prev.turn;
  const roundsDone = Math.floor(plyOf(prev) / 2);
  return settle({ ...pos, turn: mover, fullmove: prev.fullmove }, mover, roundsDone, plyOf(prev) + 1, null);
}

/** The mover gives up one of their units (not the king) toward the rent they owe. */
export function evict(pos: Position, sq: number): { pos: Position; ev: RentalEvent } | null {
  const mover = pos.turn;
  const p = pos.board[sq];
  if (!pos.rental || pos.rental.owed === null || !p || p.color !== mover || p.kind === 'K') return null;
  const board = pos.board.slice();
  board[sq] = null;
  const roundsDone = Math.floor(plyOf(pos) / 2);
  return settle({ ...pos, board }, mover, roundsDone, plyOf(pos) + 1, { sq, piece: p });
}

/** Pays the rent if possible and passes the turn; otherwise leaves it owed. `pos.turn` is the mover. */
function settle(pos: Position, mover: Color, roundsDone: number, ply: number, evicted: RentalEvent['evicted']): { pos: Position; ev: RentalEvent } {
  const r = pos.rental!;
  const rent = rentFor(pos, mover, roundsDone);
  const treasury = { ...r.treasury };
  const ev: RentalEvent = { ply, paid: null, income: null, owed: null, evicted, riseNow: null };
  if (treasury[mover] < rent) {
    ev.owed = rent;
    return { pos: { ...pos, rental: { treasury, owed: rent } }, ev };
  }
  treasury[mover] -= rent;
  ev.paid = { color: mover, amount: rent };
  // The first payment after every fifth full round: the rent has just gone up.
  if (roundsDone > 0 && roundsDone % 5 === 0 && mover === 'w') ev.riseNow = rentRise(roundsDone);
  const opp = other(mover);
  const next: Position = { ...pos, turn: opp, fullmove: mover === 'b' ? pos.fullmove + 1 : pos.fullmove };
  // The kings-only check comes right after this rent is paid, so no income is added when only kings are left.
  if (!kingsOnly(next)) {
    const income = INCOME_PER_UNIT * units(next, opp);
    treasury[opp] += income;
    ev.income = { color: opp, amount: income };
  }
  return { pos: { ...next, rental: { treasury, owed: null } }, ev };
}

export { kingsOnly };
