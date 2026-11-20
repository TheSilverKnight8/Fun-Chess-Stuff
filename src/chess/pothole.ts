// Pot-Hole Chess (Peter Spicer and Michael Chamberlain, 2001; spec 7.3): after
// every move a six-sided die is rolled. Even: a pothole opens on a square chosen
// by two eight-sided rolls (file, rank), re-rolled if it lands on a king. A
// non-king piece there is removed from the game. The pothole blocks its square
// for the next turn of the player who did not open it, then closes (base rule),
// or for 1 to 6 turns (the authors' random-duration suggestion; host's toggle).

import type { Piece, Position } from './types';

export type PotholeDuration = 'base' | 'random';

/** What the dice did after one move, for the screens to show. */
export interface Roll {
  /** The half-move this roll followed (identifies it). */
  ply: number;
  d6: number;
  /** Each square the eight-sided dice picked, in order; all but the last landed on a king. */
  tries: number[];
  /** The square a pothole opened on, or null (odd roll, or one was still open). */
  opened: number | null;
  /** The piece that fell in. */
  removed: Piece | null;
  /** Random duration: the six-sided roll for how many turns it stays open. */
  turns: number | null;
  /** The square of a pothole that closed before this roll, or null. */
  closed: number | null;
}

/** Whole numbers 0..n-1. The host passes a real random source; tests pass a fixed one. */
export type Rand = (n: number) => number;

/**
 * Applies the end of a turn to a position that has just had a move played on it:
 * the open pothole ages (and closes when its turns are used up), then the die is rolled.
 */
export function potholeStep(pos: Position, ply: number, rand: Rand, duration: PotholeDuration): { pos: Position; roll: Roll } {
  const board = pos.board.slice();
  let hole = pos.hole ?? null;
  let closed: number | null = null;
  if (hole) {
    const turns = hole.turns - 1;
    if (turns <= 0) {
      closed = hole.sq;
      hole = null;
    } else hole = { sq: hole.sq, turns };
  }
  const d6 = rand(6) + 1;
  const roll: Roll = { ply, d6, tries: [], opened: null, removed: null, turns: null, closed };
  // Only one pothole at a time (base rules). In random-duration mode an even roll while one
  // is still open opens nothing (Claude Code's reading).
  if (d6 % 2 === 0 && !hole) {
    let s: number;
    for (;;) {
      s = rand(8) + rand(8) * 8;
      roll.tries.push(s);
      if (board[s]?.kind !== 'K') break;
    }
    roll.opened = s;
    roll.removed = board[s];
    board[s] = null;
    const turns = duration === 'random' ? rand(6) + 1 : 1;
    if (duration === 'random') roll.turns = turns;
    hole = { sq: s, turns };
  }
  return { pos: { ...pos, board, hole }, roll };
}
