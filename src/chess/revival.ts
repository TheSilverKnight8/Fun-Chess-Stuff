// Revival Chess (Bardelo Bardalini; spec 7.5, Caleb's rules and Claude Code's
// picks, accepted by Caleb). Orthodox chess on the main board plus an
// auxiliary board. Each turn a player makes one move on each board, in either
// order (a board with no legal move is skipped).
//  - A piece captured on the main board goes to the auxiliary board and spawns
//    at its starting position there.
//  - A piece that captures on the auxiliary board respawns at its starting
//    position on the main board; the piece it captured is gone for good.
//  - If no starting square is free, a piece on one is removed to make room
//    (never a king). It counts as captured, even if friendly: from the main
//    board it goes to the auxiliary board; from the auxiliary board it is gone.
//  - Whoever owns the arriving piece chooses its square (or what to remove).
// Check exists on the main board only, and the game ends by checkmate there.

import { inCheck, legalMoves, play } from './standard';
import { isLightSquare, other, sq, type Arrival, type Color, type MoveInfo, type Piece, type Position, type RevivalState } from './types';

/** A piece moving between boards, for the screens to show. */
export interface Transfer {
  piece: Piece;
  from: { board: 'main' | 'aux'; sq: number };
  /** Where it arrived, or null: waiting for its owner to choose. */
  to: { board: 'main' | 'aux'; sq: number } | null;
  /** It is gone for good (captured on the auxiliary board). */
  gone?: boolean;
}

export function revivalStart(pos: Position): Position {
  return { ...pos, variant: 'revival', revival: { aux: new Array(64).fill(null), auxEp: null, mainDone: false, auxDone: false, queue: [], reset: false } };
}

/** The main board on its own, played as orthodox chess. */
const mainView = (pos: Position): Position => ({ ...pos, variant: 'standard', revival: undefined });

/** The auxiliary board on its own: no kings, no check, no castling. */
const auxView = (pos: Position): Position => ({
  ...pos,
  board: pos.revival!.aux,
  ep: pos.revival!.auxEp,
  castling: { w: { k: false, q: false }, b: { k: false, q: false } },
  variant: 'revivalAux',
  revival: undefined,
});

export const mainMoves = (pos: Position) => (pos.revival!.mainDone ? [] : legalMoves(mainView(pos)).map((m) => ({ ...m, board: 'main' as const })));
export const auxMoves = (pos: Position) => (pos.revival!.auxDone ? [] : legalMoves(auxView(pos)).map((m) => ({ ...m, board: 'aux' as const })));

/** Every move the side to move can make now (none while a piece is waiting to be placed). */
export function revivalMoves(pos: Position): MoveInfo[] {
  const r = pos.revival!;
  if (r.queue.length) return [];
  return [...mainMoves(pos), ...auxMoves(pos)];
}

/**
 * A piece's starting squares for its owner (the "valid locations"). Pawns and
 * promoted pieces: any square of the owner's second rank. Rooks, knights:
 * either of the two. Bishops: the one of their own square colour.
 */
export function startSquares(p: Piece, bishopLight: boolean): number[] {
  const r1 = p.color === 'w' ? 0 : 7;
  const r2 = p.color === 'w' ? 1 : 6;
  if (p.kind === 'P' || p.promoted) return Array.from({ length: 8 }, (_, f) => sq(f, r2));
  switch (p.kind) {
    case 'Q':
      return [sq(3, r1)];
    case 'R':
      return [sq(0, r1), sq(7, r1)];
    case 'N':
      return [sq(1, r1), sq(6, r1)];
    case 'B':
      return [sq(2, r1), sq(5, r1)].filter((s) => isLightSquare(s) === bishopLight);
    default:
      return [sq(4, r1)];
  }
}

function arrival(piece: Piece, board: 'main' | 'aux', from: Arrival['from'], target: (Piece | null)[], pos: Position): Arrival {
  const starts = startSquares(piece, isLightSquare(from.sq));
  const free = starts.filter((s) => !target[s]);
  if (free.length) return { piece, board, owner: piece.color, mode: 'place', options: free, from };
  let occupied = starts.filter((s) => target[s] && target[s]!.kind !== 'K');
  // Making room on the main board may not leave the owner's own king in check (when there is a choice).
  if (board === 'main') {
    const safe = occupied.filter((s) => {
      const b = target.slice();
      b[s] = { ...piece };
      return !inCheck({ ...mainView(pos), board: b }, piece.color);
    });
    if (safe.length) occupied = safe;
  }
  return { piece, board, owner: piece.color, mode: 'displace', options: occupied, from };
}

/** Plays a move on either board. Returns the new position and the pieces that changed boards. */
export function playRevival(pos: Position, m: MoveInfo): { pos: Position; transfers: Transfer[] } {
  const r = pos.revival!;
  const mover = pos.turn;
  const transfers: Transfer[] = [];
  let next: Position;
  const state: RevivalState = { ...r, queue: [...r.queue] };
  if ((m.board ?? 'main') === 'main') {
    const after = play(mainView(pos), m);
    next = { ...pos, board: after.board, castling: after.castling, ep: after.ep, nextId: after.nextId };
    state.mainDone = true;
    if (m.captured || m.piece.kind === 'P') state.reset = true;
    // Captured on the main board: off to the auxiliary board.
    if (m.captured && m.captureSq !== null) state.queue.push(arrival(m.captured, 'aux', { board: 'main', sq: m.captureSq }, state.aux, pos));
  } else {
    const after = play(auxView(pos), m);
    const aux = after.board.slice();
    state.auxEp = after.ep;
    state.auxDone = true;
    next = { ...pos, nextId: after.nextId };
    if (m.captured || m.piece.kind === 'P') state.reset = true;
    if (m.captured && m.captureSq !== null) {
      // Captured on the auxiliary board: gone for good. The capturer goes back to the main board.
      transfers.push({ piece: m.captured, from: { board: 'aux', sq: m.captureSq }, to: null, gone: true });
      const capturer = aux[m.to]!;
      aux[m.to] = null;
      state.aux = aux;
      state.queue.push(arrival(capturer, 'main', { board: 'aux', sq: m.to }, next.board, next));
    } else state.aux = aux;
  }
  next = { ...next, revival: state, turn: mover };
  return settle(next, transfers);
}

/** The owner of the waiting piece chooses its square (or, with no free square, the piece to remove). */
export function choose(pos: Position, target: number): { pos: Position; transfers: Transfer[] } | null {
  const r = pos.revival!;
  const a = r.queue[0];
  if (!a || !a.options.includes(target)) return null;
  return settle(placeArrival(pos, a, target, []), []);
}

function placeArrival(pos: Position, a: Arrival, target: number, transfers: Transfer[]): Position {
  const r = pos.revival!;
  const state: RevivalState = { ...r, queue: r.queue.slice(1), aux: r.aux.slice() };
  const board = a.board === 'main' ? pos.board.slice() : state.aux;
  const removed = board[target];
  board[target] = a.piece;
  transfers.push({ piece: a.piece, from: a.from, to: { board: a.board, sq: target } });
  if (removed) {
    // The piece that made room counts as captured.
    if (a.board === 'aux') transfers.push({ piece: removed, from: { board: 'aux', sq: target }, to: null, gone: true });
    else state.queue.push(arrival(removed, 'aux', { board: 'main', sq: target }, state.aux, pos));
    state.reset = true;
  }
  return { ...pos, board: a.board === 'main' ? board : pos.board, revival: state };
}

/**
 * Places every waiting piece that has only one possible square, refreshes the
 * waiting pieces' choices, and passes the turn when both boards are done.
 */
function settle(pos: Position, transfers: Transfer[]): { pos: Position; transfers: Transfer[] } {
  let p = pos;
  for (let guard = 0; guard < 64; guard++) {
    const r = p.revival!;
    if (!r.queue.length) break;
    // Refresh the head's choices against the boards as they are now.
    const head = r.queue[0];
    const fresh = arrival(head.piece, head.board, head.from, head.board === 'main' ? p.board : r.aux, p);
    p = { ...p, revival: { ...r, queue: [fresh, ...r.queue.slice(1)] } };
    if (fresh.options.length === 1) p = placeArrival(p, fresh, fresh.options[0], transfers);
    else if (fresh.options.length === 0) p = { ...p, revival: { ...p.revival!, queue: p.revival!.queue.slice(1) } };
    else return { pos: p, transfers: [...transfers, { piece: fresh.piece, from: fresh.from, to: null }] };
  }
  // A board with no legal move is skipped (Caleb).
  let r = p.revival!;
  if (!r.mainDone && legalMoves(mainView(p)).length === 0 && !inCheck(mainView(p))) r = { ...r, mainDone: true };
  if (!r.auxDone && legalMoves(auxView(p)).length === 0) r = { ...r, auxDone: true };
  p = { ...p, revival: r };
  if (r.mainDone && r.auxDone) p = passTurn(p);
  return { pos: p, transfers };
}

/** The turn passes: the next player starts with both boards to play (skipping one with no legal move). */
function passTurn(pos: Position): Position {
  const r = pos.revival!;
  const mover = pos.turn;
  let next: Position = {
    ...pos,
    turn: other(mover),
    fullmove: mover === 'b' ? pos.fullmove + 1 : pos.fullmove,
    halfmove: r.reset ? 0 : pos.halfmove + 1,
    revival: { ...r, mainDone: false, auxDone: false, reset: false, auxEp: r.auxEp },
  };
  const nr = next.revival!;
  // In check with no main-board move: not skipped (it is checkmate; status.ts ends the game).
  const mainNone = legalMoves(mainView(next)).length === 0;
  const auxNone = legalMoves(auxView(next)).length === 0;
  next = { ...next, revival: { ...nr, mainDone: mainNone && !inCheck(mainView(next)), auxDone: auxNone } };
  return next;
}

/** In check on the main board? */
export const revivalInCheck = (pos: Position) => inCheck(mainView(pos));

/** Revival's endings: checkmate on the main board; stalemate when the player has no move on either board. */
export function revivalEnd(pos: Position): { reason: 'checkmate'; winner: Color } | { reason: 'stalemate' } | null {
  const r = pos.revival!;
  if (r.queue.length) return null;
  const check = inCheck(mainView(pos));
  if (check && !r.mainDone && legalMoves(mainView(pos)).length === 0) return { reason: 'checkmate', winner: other(pos.turn) };
  if (r.mainDone && r.auxDone && !check) return { reason: 'stalemate' };
  return null;
}

