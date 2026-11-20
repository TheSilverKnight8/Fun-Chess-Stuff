// The pieces of a chess position. Plain objects only, so a position can be
// copied and sent to the other player as it is.
//
// Squares are numbers 0..63: a1 = 0, b1 = 1, ... h1 = 7, a2 = 8, ... h8 = 63.

export type Color = 'w' | 'b';
/** X: Bario's undefined Quantum piece. */
export type Kind = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | 'X';
export type PromoKind = 'Q' | 'R' | 'B' | 'N';

export const PROMO_KINDS: readonly PromoKind[] = ['Q', 'R', 'B', 'N'];

/** Remorse Chess statuses (spec 7.8). */
export type Status = 'devastated' | 'guilt' | 'psycho' | 'bloodlust';

export interface Piece {
  /** Stays with the piece for the whole game, so the board can animate it. */
  id: number;
  color: Color;
  kind: Kind;
  /** Remorse: the piece's status, if any. */
  status?: Status;
  /** Remorse: captures made as a psychopath (bloodlust at 3). */
  kills?: number;
  /** Remorse: a devastated piece's owner-turns left before it self-captures. */
  due?: number;
  /** Bario: a Quantum piece (undefined while its kind is X; defined as Q, R, B or N until its cycle ends). */
  quantum?: boolean;
}

export interface Castling {
  /** King side (with the h-file rook). */
  k: boolean;
  /** Queen side (with the a-file rook). */
  q: boolean;
}

/** Which rules the position is played under (the board-level modes). */
export type Variant = 'standard' | 'bastille' | 'pothole' | 'megaknight' | 'remorse' | 'bario' | 'rental';

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
  /** Mega Knight: each mega knight's lower-left square (it covers that square, the one right of it, and the two above). */
  mk?: number[];
  /** Mega Knight: the side to move rolled a 6 and now moves a mega knight. */
  mkRoll?: boolean;
  /** Remorse: the square of a psychopath that has its extra move to make (same side to move). */
  extra?: number | null;
  /** Bario: promotions so far (each raises every type's cap by 1 for that side) and cycles completed. */
  bario?: { promos: Record<Color, number>; cycles: Record<Color, number> };
  /** Rental: each side's treasury, and rent owed by the side to move while they choose units to give up. */
  rental?: { treasury: Record<Color, number>; owed: number | null };
}

/** A move as a player gives it. */
export interface Move {
  from: number;
  to: number;
  promo?: PromoKind;
  /** Mega Knight: moves a mega knight (from and to are its lower-left squares). */
  mk?: boolean;
  /** Bario: the type an undefined Quantum becomes with this move. */
  define?: PromoKind;
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
  /** Mega Knight: the pieces crushed under the mega knight's new squares. */
  crushed?: Piece[];
  /** Mega Knight: the squares those pieces stood on (same order). */
  crushedSq?: number[];
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
export const KIND_NAME: Record<Kind, string> = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn', X: 'Quantum' };
