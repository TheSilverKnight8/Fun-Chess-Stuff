// How a game ends on the board (Standard, Bastille, Pot-Hole): checkmate, and the draws in spec
// section 6 (stalemate, threefold repetition, the fifty-move rule,
// insufficient material). Caleb's answer: repetition and the fifty-move rule
// end the game by themselves; nobody has to claim them.

import { findKing, findLegal, inCheck, legalMoves, play } from './standard';
import { revivalEnd } from './revival';
import { isLightSquare, other, type Color, type Move, type MoveInfo, type Position } from './types';

export type BoardEnd =
  | { reason: 'checkmate'; winner: Color }
  | { reason: 'stalemate' }
  | { reason: 'repetition' }
  | { reason: 'fifty' }
  | { reason: 'material' }
  /** Bastille: a palace was emptied; the winner is the other side. */
  | { reason: 'palace'; winner: Color }
  /** Bastille: one move emptied both palaces (Claude's call in the spec: a draw). */
  | { reason: 'palaceBoth' }
  /** Mega Knight: a king was crushed; Remorse: a king captured itself or was taken by its own bloodlust piece. */
  | { reason: 'kingLost'; winner: Color }
  /** Rental: the loser had to give up their king to pay rent. */
  | { reason: 'bankrupt'; winner: Color }
  /** Rental: only kings are left; the smaller treasury loses. */
  | { reason: 'treasury'; winner: Color }
  /** Rental: only kings are left with equal treasuries (Claude's call in the spec: a draw). */
  | { reason: 'treasuryTie' };

/** A game in progress on the board: the position plus what the draw rules need to remember. */
export interface BoardGame {
  pos: Position;
  /** How many times each position has occurred (see repetitionKey). */
  seen: Record<string, number>;
  lastMove: MoveInfo | null;
  end: BoardEnd | null;
}

export function newBoardGame(pos: Position): BoardGame {
  const g: BoardGame = { pos, seen: {}, lastMove: null, end: null };
  g.seen[repetitionKey(pos)] = 1;
  g.end = boardEnd(g);
  return g;
}

/**
 * Plays a move if it is legal. Returns the new game, or null for an illegal move
 * or a game that is already over.
 */
export function playMove(g: BoardGame, move: Move, after?: (pos: Position, m: MoveInfo, prev: Position) => Position): BoardGame | null {
  if (g.end) return null;
  const m = findLegal(g.pos, move);
  if (!m) return null;
  let pos = play(g.pos, m);
  // Something that happens after the move within the same turn (Pot-Hole's die
  // roll). Skipped when the move itself ends the game.
  if (after && (afterAlways(pos) || !boardEnd({ pos, seen: g.seen, lastMove: m, end: null }, false))) pos = after(pos, m, g.pos);
  const key = repetitionKey(pos);
  const seen = { ...g.seen, [key]: (g.seen[key] ?? 0) + 1 };
  const next: BoardGame = { pos, seen, lastMove: m, end: null };
  next.end = boardEnd(next);
  return next;
}

/** Modes whose after-move rules run even after a move that would otherwise end the game (Mega Knight's crush and knights forming, Remorse's statuses). */
const afterAlways = (pos: Position) => pos.variant === 'megaknight' || pos.variant === 'remorse' || pos.variant === 'rental';

/** Bastille's palaces: d1, e1, d2, e2 for White; d8, e8, d7, e7 for Black. */
export const PALACE: Record<Color, number[]> = { w: [3, 4, 11, 12], b: [59, 60, 51, 52] };

/** How many of its own pieces a side has inside its palace (only the owner's pieces count: Caleb). */
export const palaceCount = (pos: Position, c: Color) => PALACE[c].filter((s) => pos.board[s]?.color === c).length;

/**
 * Checked in this order after every move: checkmate (it stands even if the
 * same move also completes a repetition or the fiftieth move), then stalemate,
 * insufficient material, threefold repetition, the fifty-move rule.
 */
export function boardEnd(g: BoardGame, repetition = true): BoardEnd | null {
  const { pos } = g;
  if (pos.variant === 'bastille') {
    // You win when the opponent has none of their own pieces in their palace, even if they emptied it themselves.
    const wOut = palaceCount(pos, 'w') === 0;
    const bOut = palaceCount(pos, 'b') === 0;
    if (wOut && bOut) return { reason: 'palaceBoth' };
    if (wOut) return { reason: 'palace', winner: 'b' };
    if (bOut) return { reason: 'palace', winner: 'w' };
    // Section 6 for Bastille: no legal move is a draw; repetition and the fifty-move rule apply; no insufficient material.
    if (legalMoves(pos).length === 0) return { reason: 'stalemate' };
    if (repetition && (g.seen[repetitionKey(pos)] ?? 0) >= 3) return { reason: 'repetition' };
    if (pos.halfmove >= 100) return { reason: 'fifty' };
    return null;
  }
  if (pos.variant === 'megaknight' || pos.variant === 'remorse') {
    // A king that is gone: crushed (Mega Knight), self-captured or eaten by its own bloodlust piece (Remorse).
    const wGone = findKing(pos, 'w') < 0;
    const bGone = findKing(pos, 'b') < 0;
    // Both crushed by one move: the mover loses (the mover is the side not to move now).
    if (wGone && bGone) return { reason: 'kingLost', winner: pos.turn };
    if (wGone) return { reason: 'kingLost', winner: 'b' };
    if (bGone) return { reason: 'kingLost', winner: 'w' };
  }
  if (pos.variant === 'revival' && pos.revival) {
    // Checkmate on the main board; stalemate with no move on either board; repetition (both boards) and fifty moves.
    const e = revivalEnd(pos);
    if (e) return e;
    if (pos.revival.queue.length) return null;
    if (repetition && (g.seen[repetitionKey(pos)] ?? 0) >= 3) return { reason: 'repetition' };
    if (pos.halfmove >= 100) return { reason: 'fifty' };
    return null;
  }
  if (pos.variant === 'rental' && pos.rental) {
    const r = pos.rental;
    // Rent owed: the mover is choosing units to give up. With only the king left, it is bankruptcy.
    if (r.owed !== null) {
      const own = pos.board.filter((p) => p?.color === pos.turn);
      return own.length <= 1 ? { reason: 'bankrupt', winner: other(pos.turn) } : null;
    }
    // Kings only: the smaller treasury loses (Betza's tiebreaker); equal is a draw.
    if (pos.board.every((p) => !p || p.kind === 'K')) {
      const { w, b } = r.treasury;
      return w === b ? { reason: 'treasuryTie' } : { reason: 'treasury', winner: w > b ? 'w' : 'b' };
    }
    // Section 6 for Rental: stalemate is a draw; repetition and the fifty-move rule do not apply.
    const ms = legalMoves(pos);
    if (ms.length === 0) return inCheck(pos) ? { reason: 'checkmate', winner: other(pos.turn) } : { reason: 'stalemate' };
    return null;
  }
  const moves = legalMoves(pos);
  if (pos.variant === 'megaknight' && moves.length === 0 && inCheck(pos)) {
    // In check with no piece move: the player may still roll (a 6 that gets out of check saves them).
    return null;
  }
  if (moves.length === 0) {
    return inCheck(pos) ? { reason: 'checkmate', winner: pos.turn === 'w' ? 'b' : 'w' } : { reason: 'stalemate' };
  }
  // Bario: only king against king is insufficient (a Quantum could become anything). Mega Knight: never.
  if (pos.variant === 'bario' ? pos.board.every((p) => !p || p.kind === 'K') : pos.variant !== 'megaknight' && deadPosition(pos)) return { reason: 'material' };
  if (repetition && (g.seen[repetitionKey(pos)] ?? 0) >= 3) return { reason: 'repetition' };
  if (pos.halfmove >= 100) return { reason: 'fifty' };
  return null;
}

/**
 * Two positions are the same for repetition when the same side is to move, the
 * same kinds of pieces of the same colors stand on the same squares, and the
 * same moves are possible: the castling rights match, and an en passant
 * capture is possible in both or neither (FIDE's definition). The en passant
 * square only counts when a legal en passant capture exists.
 */
export function repetitionKey(pos: Position): string {
  let s = '';
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    s += p ? (p.color === 'w' ? p.kind : p.kind.toLowerCase()) + (p.status ? `(${p.status}${p.kills ?? ''}${p.due ?? ''})` : '') + (p.quantum ? '~' : '') : '.';
  }
  const c = pos.castling;
  s += ` ${pos.turn} ${c.w.k ? 'K' : ''}${c.w.q ? 'Q' : ''}${c.b.k ? 'k' : ''}${c.b.q ? 'q' : ''}`;
  if (pos.ep !== null && legalMoves(pos).some((m) => m.enPassant)) s += ` ep${pos.ep}`;
  // Pot-Hole: the open pothole is part of the position (spec section 6), with the moves it has left (Claude Code's reading).
  if (pos.hole) s += ` hole${pos.hole.sq}:${pos.hole.turns}`;
  // Mega Knight: the mega knights; Remorse: statuses (above) and a pending extra move.
  if (pos.mk?.length) s += ` mk${[...pos.mk].sort((a, b) => a - b).join(',')}`;
  if (pos.extra !== null && pos.extra !== undefined) s += ` x${pos.extra}`;
  // Bario: the cycle count is part of the position (spec section 6); promotions change the caps.
  if (pos.bario) s += ` c${pos.bario.cycles.w}.${pos.bario.cycles.b} p${pos.bario.promos.w}.${pos.bario.promos.b}`;
  // Revival: both boards are part of the position (spec section 6), and where the turn stands.
  if (pos.revival) {
    const r = pos.revival;
    s += ' aux' + r.aux.map((p) => (p ? (p.color === 'w' ? p.kind : p.kind.toLowerCase()) + (p.promoted ? '+' : '') : '.')).join('') + ` ${r.mainDone ? 1 : 0}${r.auxDone ? 1 : 0} q${r.queue.length} e${r.auxEp ?? '-'}`;
  }
  return s;
}

/**
 * Insufficient material for the whole board (spec section 6): neither side can
 * ever checkmate. That is the case when no pawns, rooks or queens are left and
 * the minor pieces are either none, a single knight, or bishops that all stand
 * on squares of one color (K v K, K+N v K, K+B v K, K+B v K+B with bishops on
 * the same color, and so on).
 */
export function deadPosition(pos: Position): boolean {
  return insufficient(pos, null);
}

/**
 * The same test applied to one side only: could this side's own pieces never
 * checkmate? Used when the other player runs out of time (Caleb's answer: a
 * draw if the opponent has insufficient material). A lone king, a king and one
 * knight, or a king and bishops all on one color of square.
 */
export function sideCannotMate(pos: Position, color: Color): boolean {
  return insufficient(pos, color);
}

function insufficient(pos: Position, only: Color | null): boolean {
  let knights = 0;
  let lightBishops = 0;
  let darkBishops = 0;
  for (let s = 0; s < 64; s++) {
    const p = pos.board[s];
    if (!p || p.kind === 'K') continue;
    if (only && p.color !== only) continue;
    if (p.kind === 'P' || p.kind === 'R' || p.kind === 'Q') return false;
    if (p.kind === 'N') knights++;
    else if (isLightSquare(s)) lightBishops++;
    else darkBishops++;
  }
  const bishops = lightBishops + darkBishops;
  if (knights === 0 && bishops === 0) return true;
  if (knights === 1 && bishops === 0) return true;
  if (knights === 0 && (lightBishops === 0 || darkBishops === 0)) return true;
  return false;
}

