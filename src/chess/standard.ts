// Orthodox chess: the starting position, legal moves, and making a move.
// This is Standard Chess as the spec describes it (section 7.1); the variants
// in later stages build on it.

import {
  PROMO_KINDS,
  fileOf,
  onBoard,
  other,
  rankOf,
  sq,
  type Color,
  type Kind,
  type Move,
  type MoveInfo,
  type Piece,
  type Position,
  type Variant,
} from './types';

const KNIGHT_STEPS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const;
const KING_STEPS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const;
const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

const BACK_RANK: Kind[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

/** Rook starting squares, for castling rights. */
const ROOK_HOME: Record<Color, { k: number; q: number }> = {
  w: { k: sq(7, 0), q: sq(0, 0) },
  b: { k: sq(7, 7), q: sq(0, 7) },
};
const KING_HOME: Record<Color, number> = { w: sq(4, 0), b: sq(4, 7) };

export function startPosition(variant: Variant = 'standard'): Position {
  const board: (Piece | null)[] = new Array(64).fill(null);
  let id = 1;
  for (let f = 0; f < 8; f++) {
    board[sq(f, 0)] = { id: id++, color: 'w', kind: BACK_RANK[f] };
    board[sq(f, 1)] = { id: id++, color: 'w', kind: 'P' };
  }
  for (let f = 0; f < 8; f++) {
    board[sq(f, 6)] = { id: id++, color: 'b', kind: 'P' };
    board[sq(f, 7)] = { id: id++, color: 'b', kind: BACK_RANK[f] };
  }
  return {
    board,
    turn: 'w',
    castling: { w: { k: true, q: true }, b: { k: true, q: true } },
    ep: null,
    halfmove: 0,
    fullmove: 1,
    nextId: id,
    variant,
    hole: null,
  };
}

export function findKing(pos: Position, color: Color): number {
  for (let s = 0; s < 64; s++) {
    const p = pos.board[s];
    if (p && p.kind === 'K' && p.color === color) return s;
  }
  return -1;
}

/** Is square `target` attacked by any piece of color `by`? */
export function isAttacked(board: (Piece | null)[], target: number, by: Color, hole: Block = null): boolean {
  const tf = fileOf(target);
  const tr = rankOf(target);
  // Pawns: a white pawn attacks up the board, so look one rank down from the target.
  const pr = by === 'w' ? tr - 1 : tr + 1;
  for (const df of [-1, 1]) {
    const f = tf + df;
    if (onBoard(f, pr)) {
      const p = board[sq(f, pr)];
      if (p && p.color === by && p.kind === 'P' && givesCheck(p)) return true;
    }
  }
  for (const [df, dr] of KNIGHT_STEPS) {
    const f = tf + df;
    const r = tr + dr;
    if (onBoard(f, r)) {
      const p = board[sq(f, r)];
      if (p && p.color === by && p.kind === 'N' && givesCheck(p)) return true;
    }
  }
  for (const [df, dr] of KING_STEPS) {
    const f = tf + df;
    const r = tr + dr;
    if (onBoard(f, r)) {
      const p = board[sq(f, r)];
      if (p && p.color === by && p.kind === 'K' && givesCheck(p)) return true;
    }
  }
  if (slides(board, tf, tr, ROOK_DIRS, by, 'R', hole)) return true;
  if (slides(board, tf, tr, BISHOP_DIRS, by, 'B', hole)) return true;
  return false;
}

function slides(board: (Piece | null)[], tf: number, tr: number, dirs: readonly (readonly [number, number])[], by: Color, kind: 'R' | 'B', hole: Block) {
  for (const [df, dr] of dirs) {
    let f = tf + df;
    let r = tr + dr;
    while (onBoard(f, r)) {
      // Pot-Hole's pothole and Mega Knight's mega knights block lines (only knights jump them).
      if (hole?.has(sq(f, r))) break;
      const p = board[sq(f, r)];
      if (p) {
        if (p.color === by && (p.kind === kind || p.kind === 'Q') && givesCheck(p)) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }
  return false;
}

/** Does the piece on `from` attack `target`? */
export function attacks(board: (Piece | null)[], from: number, target: number, hole: Block = null): boolean {
  const p = board[from];
  if (!p || from === target) return false;
  const df = fileOf(target) - fileOf(from);
  const dr = rankOf(target) - rankOf(from);
  switch (p.kind) {
    case 'P':
      return Math.abs(df) === 1 && dr === (p.color === 'w' ? 1 : -1);
    case 'N':
      return (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
    case 'K':
      return Math.max(Math.abs(df), Math.abs(dr)) === 1;
    default: {
      const straight = df === 0 || dr === 0;
      const diagonal = Math.abs(df) === Math.abs(dr);
      if ((p.kind === 'R' && !straight) || (p.kind === 'B' && !diagonal) || (p.kind === 'Q' && !straight && !diagonal)) return false;
      const sf = Math.sign(df);
      const sr = Math.sign(dr);
      let f = fileOf(from) + sf;
      let r = rankOf(from) + sr;
      while (f !== fileOf(target) || r !== rankOf(target)) {
        if (board[sq(f, r)] || hole?.has(sq(f, r))) return false;
        f += sf;
        r += sr;
      }
      return true;
    }
  }
}

/** The squares of the pieces giving check to the side to move. */
export function checkers(pos: Position): number[] {
  const k = findKing(pos, pos.turn);
  if (k < 0) return [];
  const out: number[] = [];
  for (let s = 0; s < 64; s++) {
    const p = pos.board[s];
    if (p && p.color !== pos.turn && attacks(pos.board, s, k, holeOf(pos))) out.push(s);
  }
  return out;
}

/** The open pothole's square (Pot-Hole), or null. */
export const holeOf = (pos: Position): Block => blockedOf(pos);

/** Squares no ordinary piece may enter or pass over: the pothole and every mega knight's four squares. */
export type Block = Set<number> | null;
export function blockedOf(pos: Position): Block {
  if (!pos.hole && !pos.mk?.length) return null;
  const b = new Set<number>();
  if (pos.hole) b.add(pos.hole.sq);
  for (const a of pos.mk ?? []) for (const d of [0, 1, 8, 9]) b.add(a + d);
  return b;
}

/** Remorse: devastated and guilt-ridden pieces do not give check (Caleb). */
export const givesCheck = (p: Piece) => p.status !== 'devastated' && p.status !== 'guilt';

/** Do kings count as royal (check, checkmate)? Not in Bastille Chess. */
export const royal = (pos: Position) => pos.variant !== 'bastille';

export function inCheck(pos: Position, color: Color = pos.turn): boolean {
  if (!royal(pos)) return false;
  const k = findKing(pos, color);
  return k >= 0 && isAttacked(pos.board, k, other(color), holeOf(pos));
}

/** Moves that follow the pieces' movement rules, before checking that the own king is safe. */
function pseudoMoves(pos: Position): MoveInfo[] {
  const out: MoveInfo[] = [];
  const { board, turn } = pos;
  const hole = holeOf(pos);
  // Where kings are royal, a king is never captured (it is checkmated instead).
  // A pothole can expose a king to attack on the other player's turn; it still cannot be taken.
  const kingSafe = royal(pos);
  const add = (from: number, to: number, extra: Partial<MoveInfo> = {}) => {
    if (hole?.has(to)) return;
    const piece = board[from]!;
    const captured = extra.enPassant ? board[extra.captureSq!] : board[to];
    if (kingSafe && captured?.kind === 'K' && captured.color !== turn) return;
    // Remorse: a guilt-ridden piece cannot capture; a bloodlust piece can only move to capture.
    if (piece.status === 'guilt' && captured) return;
    if (piece.status === 'bloodlust' && !captured) return;
    out.push({
      from,
      to,
      piece,
      captured: captured ?? null,
      captureSq: captured ? (extra.captureSq ?? to) : null,
      castle: null,
      enPassant: false,
      double: false,
      ...extra,
    });
  };

  // Remorse: a bloodlust piece can capture friendly pieces too.
  const takes = (p: Piece, t: Piece) => t.color !== turn || p.status === 'bloodlust';
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || p.color !== turn) continue;
    // Remorse: a devastated piece cannot act; during a psychopath's extra move only that piece moves.
    if (p.status === 'devastated') continue;
    if (pos.extra !== undefined && pos.extra !== null && from !== pos.extra) continue;
    const f0 = fileOf(from);
    const r0 = rankOf(from);

    if (p.kind === 'P') {
      const dir = turn === 'w' ? 1 : -1;
      const startRank = turn === 'w' ? 1 : 6;
      const lastRank = turn === 'w' ? 7 : 0;
      const r1 = r0 + dir;
      const pushPawn = (to: number, extra: Partial<MoveInfo> = {}) => {
        if (rankOf(to) === lastRank) for (const promo of PROMO_KINDS) add(from, to, { ...extra, promo });
        else add(from, to, extra);
      };
      if (onBoard(f0, r1) && !board[sq(f0, r1)] && !hole?.has(sq(f0, r1))) {
        pushPawn(sq(f0, r1));
        const r2 = r0 + 2 * dir;
        if (r0 === startRank && !board[sq(f0, r2)]) add(from, sq(f0, r2), { double: true });
      }
      for (const df of [-1, 1]) {
        const f = f0 + df;
        if (!onBoard(f, r1)) continue;
        const to = sq(f, r1);
        const target = board[to];
        if (target && takes(p, target)) pushPawn(to);
        else if (!target && pos.ep === to) {
          const capSq = sq(f, r0);
          const victim = board[capSq];
          if (victim && victim.kind === 'P' && victim.color !== turn) add(from, to, { enPassant: true, captureSq: capSq });
        }
      }
      continue;
    }

    if (p.kind === 'N' || p.kind === 'K') {
      for (const [df, dr] of p.kind === 'N' ? KNIGHT_STEPS : KING_STEPS) {
        const f = f0 + df;
        const r = r0 + dr;
        if (!onBoard(f, r)) continue;
        const to = sq(f, r);
        const target = board[to];
        if (!target || takes(p, target)) add(from, to);
      }
      if (p.kind === 'K') castleMoves(pos, from, add);
      continue;
    }

    const dirs = p.kind === 'R' ? ROOK_DIRS : p.kind === 'B' ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
    for (const [df, dr] of dirs) {
      let f = f0 + df;
      let r = r0 + dr;
      while (onBoard(f, r)) {
        const to = sq(f, r);
        if (hole?.has(to)) break;
        const target = board[to];
        if (target) {
          if (takes(p, target)) add(from, to);
          break;
        }
        add(from, to);
        f += df;
        r += dr;
      }
    }
  }
  return out;
}

/**
 * Castling: the king and that rook have not moved (the castling right), the
 * squares between them are empty, and the king is not in check, does not pass
 * through an attacked square, and does not land on one. Pot-Hole: no square
 * the king or rook passes over or lands on may be the open pothole. Bastille
 * keeps the same limits (Claude Code's reading: castling "as in the source",
 * and the source keeps orthodox castling).
 */
function castleMoves(pos: Position, from: number, add: (from: number, to: number, extra?: Partial<MoveInfo>) => void) {
  const c = pos.turn;
  if (from !== KING_HOME[c]) return;
  const rights = pos.castling[c];
  if (!rights.k && !rights.q) return;
  const enemy = other(c);
  const hole = holeOf(pos);
  const att = (s: number) => isAttacked(pos.board, s, enemy, hole);
  if (att(from)) return;
  const r = rankOf(from);
  const clear = (...files: number[]) => files.every((f) => !pos.board[sq(f, r)] && !hole?.has(sq(f, r)));
  const rookOk = (s: number) => {
    const p = pos.board[s];
    return !!p && p.kind === 'R' && p.color === c;
  };
  if (rights.k && rookOk(ROOK_HOME[c].k)) {
    const f1 = sq(5, r);
    const g1 = sq(6, r);
    if (clear(5, 6) && !att(f1) && !att(g1)) add(from, g1, { castle: 'k' });
  }
  if (rights.q && rookOk(ROOK_HOME[c].q)) {
    const d1 = sq(3, r);
    const c1 = sq(2, r);
    if (clear(1, 2, 3) && !att(d1) && !att(c1)) add(from, c1, { castle: 'q' });
  }
}

/** Every legal move for the side to move. */
export function legalMoves(pos: Position): MoveInfo[] {
  const mover = pos.turn;
  // Mega Knight: after rolling a 6, the turn's move is a mega knight move.
  if (pos.mkRoll) return megaMoves(pos).filter((m) => !inCheck(play(pos, m), mover));
  // Bastille: no royal pieces, so no check: every move that follows the pieces' rules is legal.
  if (!royal(pos)) return pseudoMoves(pos);
  return pseudoMoves(pos).filter((m) => !inCheck(play(pos, m), mover));
}

/** Makes a move that is already known to be legal. Returns a new position. */
export function play(pos: Position, m: MoveInfo): Position {
  if (m.mk) return playMega(pos, m);
  const board = pos.board.slice();
  const c = pos.turn;
  const castling = { w: { ...pos.castling.w }, b: { ...pos.castling.b } };
  let nextId = pos.nextId;

  if (m.captureSq !== null) board[m.captureSq] = null;
  let moving = board[m.from]!;
  board[m.from] = null;
  // Remorse: a promoted pawn keeps its status (Claude Code's reading).
  if (m.promo) moving = { ...moving, id: nextId++, kind: m.promo };
  board[m.to] = moving;

  if (m.castle) {
    const r = rankOf(m.from);
    const rookFrom = m.castle === 'k' ? sq(7, r) : sq(0, r);
    const rookTo = m.castle === 'k' ? sq(5, r) : sq(3, r);
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }

  // Castling rights go when the king or a rook leaves home, or a rook is captured at home.
  if (m.piece.kind === 'K') castling[c] = { k: false, q: false };
  for (const col of ['w', 'b'] as const) {
    if (m.from === ROOK_HOME[col].k || m.to === ROOK_HOME[col].k) castling[col].k = false;
    if (m.from === ROOK_HOME[col].q || m.to === ROOK_HOME[col].q) castling[col].q = false;
  }

  return {
    board,
    turn: other(c),
    castling,
    ep: m.double ? (m.from + m.to) / 2 : null,
    halfmove: m.piece.kind === 'P' || m.captured ? 0 : pos.halfmove + 1,
    fullmove: c === 'b' ? pos.fullmove + 1 : pos.fullmove,
    nextId,
    variant: pos.variant,
    hole: pos.hole ?? null,
    mk: pos.mk,
    mkRoll: false,
    extra: null,
  };
}

// ---------------------------------------------------------------- Mega Knight's mega knights

/** Knight jumps for a mega knight's lower-left corner (it moves like a knight along the grid's corners). */
const MK_STEPS = KNIGHT_STEPS;

/** The four squares a mega knight with lower-left square `a` covers. */
export const megaSquares = (a: number) => [a, a + 1, a + 8, a + 9];

/**
 * Every mega knight move. The 2x2 must stay on the board. Landing exactly on
 * another mega knight captures it; landing partly over one is not allowed
 * (Caleb). Every piece under the new squares is crushed, kings included.
 */
export function megaMoves(pos: Position): MoveInfo[] {
  const out: MoveInfo[] = [];
  const all = pos.mk ?? [];
  for (const a of all) {
    for (const [df, dr] of MK_STEPS) {
      const f = fileOf(a) + df;
      const r = rankOf(a) + dr;
      if (f < 0 || f > 6 || r < 0 || r > 6) continue;
      const to = sq(f, r);
      const partly = all.some((o) => o !== a && o !== to && Math.abs(fileOf(o) - f) <= 1 && Math.abs(rankOf(o) - r) <= 1);
      if (partly) continue;
      const crushedSq = megaSquares(to).filter((s) => !!pos.board[s]);
      const crushed = crushedSq.map((s) => pos.board[s]!);
      out.push({ from: a, to, mk: true, piece: { id: -1, color: pos.turn, kind: 'N' }, captured: crushed[0] ?? null, captureSq: null, castle: null, enPassant: false, double: false, crushed, crushedSq });
    }
  }
  return out;
}

function playMega(pos: Position, m: MoveInfo): Position {
  const board = pos.board.slice();
  for (const s of megaSquares(m.to)) board[s] = null;
  const mk = (pos.mk ?? []).filter((a) => a !== m.from && a !== m.to);
  mk.push(m.to);
  const c = pos.turn;
  return {
    ...pos,
    board,
    mk,
    mkRoll: false,
    turn: other(c),
    ep: null,
    // A crush counts as a capture for the fifty-move rule (Claude Code's reading).
    halfmove: m.crushed?.length ? 0 : pos.halfmove + 1,
    fullmove: c === 'b' ? pos.fullmove + 1 : pos.fullmove,
  };
}

/** Four knights of any colors in a 2x2 become a mega knight there (Caleb). Returns the new mega knights' squares. */
export function formMegaKnights(pos: Position): { pos: Position; formed: number[] } {
  const formed: number[] = [];
  let board = pos.board;
  for (let f = 0; f < 7; f++)
    for (let r = 0; r < 7; r++) {
      const a = sq(f, r);
      if (megaSquares(a).every((s) => board[s]?.kind === 'N')) {
        board = board.slice();
        for (const s of megaSquares(a)) board[s] = null;
        formed.push(a);
      }
    }
  if (!formed.length) return { pos, formed };
  return { pos: { ...pos, board, mk: [...(pos.mk ?? []), ...formed] }, formed };
}

/** Finds the legal move matching what a player asked for, or null if it is not legal. */
export function findLegal(pos: Position, move: Move): MoveInfo | null {
  return legalMoves(pos).find((m) => m.from === move.from && m.to === move.to && (m.promo ?? null) === (move.promo ?? null)) ?? null;
}

// ---------------------------------------------------------------- FEN (for tests and debugging)

const FEN_KIND: Record<string, Kind> = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' };

export function fromFen(fen: string): Position {
  const [placement, turn, castle, ep, half, full] = fen.trim().split(/\s+/);
  const board: (Piece | null)[] = new Array(64).fill(null);
  let id = 1;
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error(`Bad FEN: ${fen}`);
  rows.forEach((row, i) => {
    const r = 7 - i;
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        const kind = FEN_KIND[ch.toLowerCase()];
        if (!kind) throw new Error(`Bad FEN piece: ${ch}`);
        board[sq(f, r)] = { id: id++, color: ch === ch.toUpperCase() ? 'w' : 'b', kind };
        f++;
      }
    }
  });
  const c = castle ?? '-';
  return {
    board,
    turn: turn === 'b' ? 'b' : 'w',
    castling: { w: { k: c.includes('K'), q: c.includes('Q') }, b: { k: c.includes('k'), q: c.includes('q') } },
    ep: ep && ep !== '-' ? 'abcdefgh'.indexOf(ep[0]) + (Number(ep[1]) - 1) * 8 : null,
    halfmove: Number(half ?? 0),
    fullmove: Number(full ?? 1),
    nextId: id,
  };
}

export function toFen(pos: Position): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.board[sq(f, r)];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) row += empty;
      empty = 0;
      row += p.color === 'w' ? p.kind : p.kind.toLowerCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  const c = `${pos.castling.w.k ? 'K' : ''}${pos.castling.w.q ? 'Q' : ''}${pos.castling.b.k ? 'k' : ''}${pos.castling.b.q ? 'q' : ''}` || '-';
  const ep = pos.ep === null ? '-' : 'abcdefgh'[fileOf(pos.ep)] + String(rankOf(pos.ep) + 1);
  return `${rows.join('/')} ${pos.turn} ${c} ${ep} ${pos.halfmove} ${pos.fullmove}`;
}
