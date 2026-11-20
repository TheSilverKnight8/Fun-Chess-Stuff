// Mega Knight Chess (Bardelo Bardalini; spec 7.7, Caleb's rules). On a turn a
// player either moves one of their pieces or rolls a six-sided die; a 6 means
// they move a mega knight as that turn's move, anything else does nothing.

import { inCheck, legalMoves } from './standard';
import { boardEnd, repetitionKey, type BoardGame } from './status';
import { other, type Position } from './types';

/** The turn passes with nothing moved (a roll that did nothing). A roll counts as a move for the fifty-move rule (spec section 6). */
function pass(pos: Position): Position {
  return { ...pos, mkRoll: false, turn: other(pos.turn), ep: null, halfmove: pos.halfmove + 1, fullmove: pos.turn === 'b' ? pos.fullmove + 1 : pos.fullmove };
}

/**
 * The side to move rolls. A player in check who rolls anything but a 6 is
 * checkmated (Caleb). On a 6 they must now move a mega knight; if none of its
 * moves is allowed (in check: none gets the king out), a player in check is
 * checkmated and anyone else's roll does nothing (Claude Code's reading).
 */
export function rollMega(g: BoardGame, d6: number): BoardGame {
  const { pos } = g;
  const check = inCheck(pos);
  const mate = (): BoardGame => ({ ...g, end: { reason: 'checkmate', winner: other(pos.turn) } });
  if (d6 === 6) {
    const armed: Position = { ...pos, mkRoll: true };
    if (legalMoves(armed).length) return { ...g, pos: armed, end: null };
  }
  if (check) return mate();
  const next = pass(pos);
  const key = repetitionKey(next);
  const out: BoardGame = { pos: next, seen: { ...g.seen, [key]: (g.seen[key] ?? 0) + 1 }, lastMove: null, end: null };
  out.end = boardEnd(out);
  return out;
}
