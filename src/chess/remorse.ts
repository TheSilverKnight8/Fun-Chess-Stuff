// Remorse Chess: Psychos and Devastation (Bardelo Bardalini; spec 7.8, Caleb's
// rules). When a piece with no status captures, a six-sided die gives it one:
// 1 devastated, 2-3 guilt-ridden, 4-5 unaffected, 6 psychopath. Claude Code's
// readings (approved by Caleb) are noted where they apply.

import { legalMoves } from './standard';
import { fileOf, other, rankOf, type MoveInfo, type Piece, type Position, type Status } from './types';

/** What happened after a move, for the screens to show. */
export interface RemorseEvent {
  ply: number;
  /** The capturing piece's square and its roll (null if it already had a status and did not roll). */
  sq: number | null;
  d6: number | null;
  /** The capturing piece's status after the capture. */
  status: Status | null;
  /** It became bloodlust with this capture. */
  bloodlust: boolean;
  /** A psychopath's extra move is waiting. */
  extra: boolean;
  /** Squares whose pieces were absolved by a bishop. */
  absolved: number[];
  /** Devastated pieces that captured themselves: square and piece. */
  selfCaptured: { sq: number; piece: Piece }[];
}

export type Rand = (n: number) => number;

/**
 * Applies the Remorse rules to the position after a move. `prev` is the
 * position before the move (to know whether this was an extra move).
 */
export function remorseStep(prev: Position, pos: Position, m: MoveInfo, ply: number, rand: Rand): { pos: Position; ev: RemorseEvent } {
  const board = pos.board.slice();
  const mover = prev.turn;
  const wasExtra = prev.extra !== null && prev.extra !== undefined;
  const ev: RemorseEvent = { ply, sq: null, d6: null, status: null, bloodlust: false, extra: false, absolved: [], selfCaptured: [] };
  let grantExtra = false;
  const p = board[m.to];
  if (p && m.captured) {
    ev.sq = m.to;
    let q: Piece = { ...p };
    if (!q.status) {
      const d6 = rand(6) + 1;
      ev.d6 = d6;
      if (d6 === 1) q = { ...q, status: 'devastated', due: 4 };
      else if (d6 <= 3) q = { ...q, status: 'guilt' };
      else if (d6 === 6) {
        // The capture that rolls the 6 counts as the first of three, and gets the extra move at once.
        q = { ...q, status: 'psycho', kills: 1 };
        grantExtra = !wasExtra;
      }
    } else if (q.status === 'psycho' || q.status === 'bloodlust') {
      const kills = (q.kills ?? 0) + 1;
      q = { ...q, kills };
      if (q.status === 'psycho' && kills >= 3) {
        q = { ...q, status: 'bloodlust' };
        ev.bloodlust = true;
      }
      // Every capture by a psychopath gives an extra move, but not during an extra move (it does not chain).
      grantExtra = !wasExtra;
    }
    board[m.to] = q;
    ev.status = q.status ?? null;
  }
  // Absolving: one of the owner's bishops ends its move next to an afflicted piece; it clears every one around it.
  const mp = board[m.to];
  if (mp && mp.kind === 'B' && mp.color === mover) {
    for (let df = -1; df <= 1; df++)
      for (let dr = -1; dr <= 1; dr++) {
        if (!df && !dr) continue;
        const f = fileOf(m.to) + df;
        const r = rankOf(m.to) + dr;
        if (f < 0 || f > 7 || r < 0 || r > 7) continue;
        const s = r * 8 + f;
        const t = board[s];
        if (t && t.color === mover && t.status) {
          board[s] = { id: t.id, color: t.color, kind: t.kind };
          ev.absolved.push(s);
        }
      }
  }
  let next: Position = { ...pos, board };
  if (grantExtra) {
    // Same player again, with only that piece (Claude Code's reading: the extra move is optional).
    const extraPos: Position = { ...next, turn: mover, fullmove: prev.fullmove, extra: m.to };
    if (legalMoves(extraPos).length) {
      ev.extra = true;
      return { pos: extraPos, ev };
    }
  }
  next = endTurn(next, mover, ev);
  return { pos: next, ev };
}

/** The end of a player's turn: their devastated pieces count down, and capture themselves after three turns. */
function endTurn(pos: Position, mover: 'w' | 'b', ev: RemorseEvent): Position {
  const board = pos.board.slice();
  for (let s = 0; s < 64; s++) {
    const t = board[s];
    if (!t || t.color !== mover || t.status !== 'devastated') continue;
    const due = (t.due ?? 3) - 1;
    if (due <= 0) {
      ev.selfCaptured.push({ sq: s, piece: t });
      board[s] = null;
    } else board[s] = { ...t, due };
  }
  return { ...pos, board };
}

/** The player passes on a psychopath's extra move. */
export function skipExtra(pos: Position, ply: number): { pos: Position; ev: RemorseEvent } {
  const ev: RemorseEvent = { ply, sq: null, d6: null, status: null, bloodlust: false, extra: false, absolved: [], selfCaptured: [] };
  const mover = pos.turn;
  const ended = endTurn({ ...pos, extra: null }, mover, ev);
  return { pos: { ...ended, turn: other(mover), fullmove: mover === 'b' ? pos.fullmove + 1 : pos.fullmove }, ev };
}
