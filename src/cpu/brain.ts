// The CPU opponent (Caleb's request after Stage 6, overriding the spec's "No CPU
// opponent"). It plays through the same rules engine as online games, so it can
// never play a rule differently. Three levels:
//  - easy:   mostly random legal moves, but it takes captures (biggest first) most of the time.
//  - normal: searches two moves ahead, with a little variety between near-equal moves.
//  - hard:   searches deeper (up to four moves) within a time limit.
// Dice (Pot-Hole, Mega Knight, Remorse) are not predicted: the search looks at
// the moves themselves; Mega Knight's roll is valued as its chance of a 6.

import { findKing, inCheck, legalMoves, play } from '../chess/standard';
import { palaceCount } from '../chess/status';
import { skipExtra } from '../chess/remorse';
import { choose } from '../chess/revival';
import { rentFor } from '../chess/rental';
import { other, type Color, type Kind, type Move, type MoveInfo, type Position } from '../chess/types';

export type Level = 'easy' | 'normal' | 'hard';

/** What the CPU does: a move, a Mega Knight roll, skipping Remorse's extra move, giving up a unit (Rental), or placing a piece (Revival). */
export type CpuAction = { t: 'move'; move: Move } | { t: 'roll' } | { t: 'skip' } | { t: 'evict'; sq: number } | { t: 'place'; sq: number };

const VALUE: Record<Kind, number> = { P: 1, N: 3, B: 3.2, R: 5, Q: 9, K: 0, X: 5 };
const WIN = 10_000;

const plyOf = (pos: Position) => (pos.fullmove - 1) * 2 + (pos.turn === 'b' ? 1 : 0);

/** How good the position is for `me` (positive is good). */
function evaluate(pos: Position, me: Color): number {
  let score = 0;
  const center = new Set([27, 28, 35, 36]);
  pos.board.forEach((p, s) => {
    if (!p) return;
    let v = VALUE[p.kind];
    if (pos.variant === 'bastille' && p.kind === 'K') v = 2.5;
    // Remorse: statuses change what a piece is worth.
    if (p.status === 'devastated') v *= 0.2;
    else if (p.status === 'guilt') v *= 0.7;
    else if (p.status === 'bloodlust') v *= 0.85;
    // A little for the centre and for advanced pawns.
    if (center.has(s)) v += 0.15;
    if (p.kind === 'P') v += 0.05 * (p.color === 'w' ? s >> 3 : 7 - (s >> 3));
    score += p.color === me ? v : -v;
  });
  const opp = other(me);
  if (pos.variant === 'bastille') {
    // Keep your own palace occupied; empty theirs.
    const mine = palaceCount(pos, me);
    const theirs = palaceCount(pos, opp);
    score += mine * 1.2 - theirs * 1.2 + (mine === 1 ? -3 : 0) - (theirs === 1 ? -3 : 0);
  }
  if (pos.rental) {
    const t = pos.rental.treasury;
    const rounds = Math.floor(plyOf(pos) / 2);
    score += (t[me] - t[opp]) * 0.08 - (rentFor(pos, me, rounds) - rentFor(pos, opp, rounds)) * 0.05;
  }
  if (pos.revival) {
    // Pieces on the auxiliary board may come back: worth something.
    for (const p of pos.revival.aux) if (p) score += (p.color === me ? 1 : -1) * VALUE[p.kind] * 0.35;
  }
  if (pos.mk?.length) {
    // Keep the king away from mega knights.
    const k = findKing(pos, me);
    const ok = findKing(pos, opp);
    for (const a of pos.mk) {
      const d = (s: number) => Math.max(Math.abs((s & 7) - (a & 7)), Math.abs((s >> 3) - (a >> 3)));
      if (k >= 0 && d(k) <= 2) score -= 0.6;
      if (ok >= 0 && d(ok) <= 2) score += 0.6;
    }
  }
  if (inCheck(pos, opp)) score += 0.3;
  return score;
}

/** A finished game from the point of view of the side to move: +WIN won, -WIN lost, 0 drawn, null not finished. */
function terminal(pos: Position, moves: MoveInfo[]): number | null {
  const me = pos.turn;
  const opp = other(me);
  if (pos.variant === 'bastille') {
    const a = palaceCount(pos, me) === 0;
    const b = palaceCount(pos, opp) === 0;
    if (a && b) return 0;
    if (a) return -WIN;
    if (b) return WIN;
  }
  if (pos.variant === 'megaknight' || pos.variant === 'remorse') {
    const a = findKing(pos, me) < 0;
    const b = findKing(pos, opp) < 0;
    if (a && b) return pos.turn === me ? WIN : -WIN;
    if (a) return -WIN;
    if (b) return WIN;
  }
  if (pos.rental) {
    if (pos.rental.owed !== null) return pos.board.filter((p) => p?.color === me).length <= 1 ? -WIN : null;
    if (pos.board.every((p) => !p || p.kind === 'K')) {
      const t = pos.rental.treasury;
      return t[me] === t[opp] ? 0 : t[me] > t[opp] ? WIN : -WIN;
    }
  }
  if (pos.revival?.queue.length) return null;
  if (moves.length) return null;
  if (pos.variant === 'megaknight' && inCheck(pos)) return -WIN * 0.8; // can only roll for a 6
  if (pos.revival && !(pos.revival.mainDone && pos.revival.auxDone)) return null;
  return inCheck(pos) ? -WIN : 0;
}

/** Captures and promotions first: alpha-beta cuts more. */
function ordered(moves: MoveInfo[]): MoveInfo[] {
  const key = (m: MoveInfo) => (m.captured ? 10 + VALUE[m.captured.kind] * 10 - VALUE[m.piece.kind] : 0) + (m.promo === 'Q' ? 50 : 0) + (m.crushed?.length ? 5 * m.crushed.length : 0);
  return [...moves].sort((a, b) => key(b) - key(a));
}

/** Children of a position, with whether the same side moves again (Revival's two moves, Remorse's extra move). */
function children(pos: Position, moves: MoveInfo[]): Position[] {
  const out = moves.map((m) => play(pos, m));
  if (pos.variant === 'remorse' && pos.extra !== null && pos.extra !== undefined) out.push(skipExtra(pos, plyOf(pos)).pos);
  return out;
}

interface Budget {
  deadline: number;
  nodes: number;
  stop: boolean;
}

/** Negamax with alpha-beta, from the point of view of the side to move. */
function search(pos: Position, depth: number, alpha: number, beta: number, b: Budget): number {
  b.nodes++;
  if ((b.nodes & 1023) === 0 && performance.now() > b.deadline) b.stop = true;
  if (b.stop) return 0;
  const moves = pos.revival?.queue.length ? [] : legalMoves(pos);
  const t = terminal(pos, moves);
  if (t !== null) return t === 0 ? 0 : t + (t > 0 ? depth : -depth);
  if (depth <= 0 || !moves.length) return evaluate(pos, pos.turn);
  let best = -Infinity;
  for (const next of children(pos, ordered(moves))) {
    const same = next.turn === pos.turn;
    const v = same ? search(next, depth - 1, alpha, beta, b) : -search(next, depth - 1, -beta, -alpha, b);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** The value of each root option for the side to move. */
function scoreOptions(pos: Position, depth: number, b: Budget): { action: CpuAction; v: number }[] {
  const me = pos.turn;
  const out: { action: CpuAction; v: number }[] = [];
  const val = (next: Position) => (next.turn === me ? search(next, depth - 1, -Infinity, Infinity, b) : -search(next, depth - 1, -Infinity, Infinity, b));
  for (const m of ordered(legalMoves(pos))) out.push({ action: { t: 'move', move: { from: m.from, to: m.to, promo: m.promo, mk: m.mk, define: m.define, board: m.board } }, v: val(play(pos, m)) });
  if (pos.variant === 'remorse' && pos.extra !== null && pos.extra !== undefined) out.push({ action: { t: 'skip' }, v: val(skipExtra(pos, plyOf(pos)).pos) });
  if (pos.variant === 'megaknight' && !pos.mkRoll) {
    // A roll: a 1 in 6 chance of the best mega knight move, otherwise the turn passes (or, in check, checkmate).
    const armed: Position = { ...pos, mkRoll: true };
    const mk = legalMoves(armed);
    const six = mk.length ? Math.max(...mk.map((m) => val(play(armed, m)))) : -WIN;
    const passed: Position = { ...pos, turn: other(me), ep: null, fullmove: me === 'b' ? pos.fullmove + 1 : pos.fullmove, halfmove: pos.halfmove + 1 };
    const nothing = inCheck(pos) ? -WIN : -search(passed, depth - 1, -Infinity, Infinity, b);
    out.push({ action: { t: 'roll' }, v: six / 6 + (nothing * 5) / 6 });
  }
  return out;
}

const rand = (n: number) => Math.floor(Math.random() * n);

/** Chooses the CPU's action in this position (it is the CPU's turn, or its piece to place). */
export function think(pos: Position, level: Level, cpu: Color): CpuAction | null {
  // Revival: placing a waiting piece (or choosing what makes room).
  const head = pos.revival?.queue[0];
  if (head) {
    if (head.owner !== cpu) return null;
    if (level === 'easy') return { t: 'place', sq: head.options[rand(head.options.length)] };
    let best = head.options[0];
    let bestV = -Infinity;
    for (const s of head.options) {
      const r = choose(pos, s);
      if (!r) continue;
      const v = evaluate(r.pos, cpu);
      if (v > bestV) {
        bestV = v;
        best = s;
      }
    }
    return { t: 'place', sq: best };
  }
  if (pos.turn !== cpu) return null;
  // Rental: rent owed: give up the cheapest unit first (the one on the dearest square among equals).
  if (pos.rental?.owed !== null && pos.rental?.owed !== undefined) {
    const units = pos.board.flatMap((p, s) => (p && p.color === cpu && p.kind !== 'K' ? [{ s, v: VALUE[p.kind] }] : []));
    if (!units.length) return null;
    if (level === 'easy') return { t: 'evict', sq: units[rand(units.length)].s };
    units.sort((a, b) => a.v - b.v);
    return { t: 'evict', sq: units[0].s };
  }

  if (level === 'easy') {
    const moves = legalMoves(pos);
    if (pos.variant === 'megaknight' && !pos.mkRoll && Math.random() < 0.15) return { t: 'roll' };
    if (!moves.length) return pos.variant === 'remorse' && pos.extra != null ? { t: 'skip' } : pos.variant === 'megaknight' ? { t: 'roll' } : null;
    const caps = moves.filter((m) => m.captured || m.crushed?.length);
    const pick = caps.length && Math.random() < 0.7 ? ordered(caps)[0] : moves[rand(moves.length)];
    return { t: 'move', move: { from: pick.from, to: pick.to, promo: pick.promo, mk: pick.mk, define: pick.define, board: pick.board } };
  }

  const start = performance.now();
  const limit = level === 'hard' ? 1500 : 600;
  const maxDepth = level === 'hard' ? 4 : 2;
  let options: { action: CpuAction; v: number }[] = [];
  for (let d = 1; d <= maxDepth; d++) {
    const b: Budget = { deadline: start + limit, nodes: 0, stop: false };
    const scored = scoreOptions(pos, d, b);
    if (b.stop && options.length) break;
    options = scored;
    if (performance.now() - start > limit * 0.5) break;
  }
  if (!options.length) return pos.variant === 'megaknight' ? { t: 'roll' } : null;
  options.sort((a, b) => b.v - a.v);
  // Normal: some variety among moves close to the best.
  if (level === 'normal') {
    const near = options.filter((o) => o.v >= options[0].v - 0.35);
    return near[rand(near.length)].action;
  }
  return options[0].action;
}
