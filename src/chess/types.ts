// The pieces of a chess position. Plain objects only, so a position can be
// copied and sent to the other player as it is.
//
// Squares are numbers 0..63: a1 = 0, b1 = 1, ... h1 = 7, a2 = 8, ... h8 = 63.

export type Color = 'w' | 'b';
export type Kind = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
export type PromoKind = 'Q' | 'R' | 'B' | 'N';

export const PROMO_KINDS: readonly PromoKind[] = ['Q', 'R', 'B', 'N'];

export interface Piece {
  /** Stays with the piece for the whole game, so the board can animate it. */
  id: number;
  color: Color;
  kind: Kind;
}

export interface Castling {
  /** King side (with the h-file rook). */
  k: boolean;
  /** Queen side (with the a-file rook). */
  q: boolean;
}

/** Which rules the position is played under (the board-level modes). */
export type Variant = 'standard' | 'bastille' | 'pothole';

/** An open pothole (Pot-Hole Chess): its square, and how many more moves it stays open. */
export interface Hole {
  sq: number;
  turns: number;
}

export interface Position {
  board: (Piece | null)[];
  turn: Color;
  castling: Record<Color, Castling>;
  /** The square a pawn skipped over on the last move (a double step), or null. */
  ep: number | null;
  /** Half-moves since the last capture or pawn move (the fifty-move rule). */
  halfmove: number;
  /** Starts at 1, goes up after Black moves. */
  fullmove: number;
  /** The next free piece id (promotions make new pieces). */
  nextId: number;
  /** Missing means Standard. */
  variant?: Variant;
  /** Pot-Hole: the open pothole, if any. */
  hole?: Hole | null;
}

/** A move as a player gives it. */
export interface Move {
  from: number;
  to: number;
  promo?: PromoKind;
}

/** A legal move with everything the board needs to show it. */
export interface MoveInfo extends Move {
  piece: Piece;
  captured: Piece | null;
  /** Where the captured piece stood (differs from `to` for en passant). */
  captureSq: number | null;
  castle: 'k' | 'q' | null;
  enPassant: boolean;
  /** A pawn's two-square first step. */
  double: boolean;
}

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const fileOf = (sq: number) => sq & 7;
export const rankOf = (sq: number) => sq >> 3;
export const sq = (file: number, rank: number) => rank * 8 + file;
export const onBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8;

export function squareName(s: number) {
  return 'abcdefgh'[fileOf(s)] + String(rankOf(s) + 1);
}

export function parseSquare(name: string): number {
  const f = 'abcdefgh'.indexOf(name[0]);
  const r = Number(name[1]) - 1;
  if (f < 0 || !(r >= 0 && r < 8) || name.length !== 2) throw new Error(`Not a square: ${name}`);
  return sq(f, r);
}

/** Light squares are the ones where file + rank is odd (h1 is light). */
export const isLightSquare = (s: number) => (fileOf(s) + rankOf(s)) % 2 === 1;

export const COLOR_NAME: Record<Color, string> = { w: 'White', b: 'Black' };
export const KIND_NAME: Record<Kind, string> = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' };
