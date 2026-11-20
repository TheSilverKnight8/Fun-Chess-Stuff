// Checks the rules outside the browser: npm run check:rules
//  1. Move generation: counts every move sequence to a fixed depth ("perft")
//     from well-known test positions and compares with the published counts.
//  2. The section 6 draws, checkmate, and the timeout rule on hand-made positions.

import { checkers, fromFen, inCheck, legalMoves, play, startPosition } from '../src/chess/standard.ts';
import { deadPosition, newBoardGame, playMove, repetitionKey, sideCannotMate, type BoardGame } from '../src/chess/status.ts';
import { potholeStep } from '../src/chess/pothole.ts';
import { rollMega } from '../src/chess/megaknight.ts';
import { remorseStep, skipExtra } from '../src/chess/remorse.ts';
import { formMegaKnights, findLegal, quantumAvail } from '../src/chess/standard.ts';
import { choose, playRevival, revivalStart, startSquares } from '../src/chess/revival.ts';
import { evict, rentFor, rentalAfterMove, rentalStart, squareRent } from '../src/chess/rental.ts';
import { parseSquare, type Position, type Variant } from '../src/chess/types.ts';

let failed = false;
const check = (ok: boolean, what: string) => {
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

function perft(pos: Position, depth: number): number {
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(play(pos, m), depth - 1);
  return n;
}

// Published perft counts (Chess Programming Wiki, "Perft Results"), and checked
// against python-chess while building.
const PERFT: { name: string; fen: string; counts: number[] }[] = [
  { name: 'start', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', counts: [20, 400, 8902, 197281] },
  { name: 'kiwipete', fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', counts: [48, 2039, 97862] },
  { name: 'position 3', fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', counts: [14, 191, 2812, 43238] },
  { name: 'position 4', fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', counts: [6, 264, 9467] },
  { name: 'position 5', fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', counts: [44, 1486, 62379] },
  { name: 'position 6', fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', counts: [46, 2079, 89890] },
];

console.log('Move generation (perft)');
for (const t of PERFT) {
  const pos = fromFen(t.fen);
  t.counts.forEach((want, i) => {
    const t0 = performance.now();
    const got = perft(pos, i + 1);
    check(got === want, `${t.name} depth ${i + 1}: ${got} (expected ${want}, ${Math.round(performance.now() - t0)} ms)`);
  });
}

// The pieces giving check (used by the check effect) agree with the check test,
// over every position three moves deep from the test positions.
{
  let positions = 0;
  let mismatches = 0;
  let checks = 0;
  const walk = (pos: Position, depth: number) => {
    positions++;
    const c = checkers(pos);
    if (c.length > 0) checks++;
    if ((c.length > 0) !== inCheck(pos)) mismatches++;
    if (depth === 0) return;
    for (const m of legalMoves(pos)) walk(play(pos, m), depth - 1);
  };
  for (const t of PERFT) walk(fromFen(t.fen), 2);
  check(mismatches === 0, `checking pieces agree with the check test (${positions} positions, ${checks} in check)`);
}

// ---------------------------------------------------------------- endings

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const mv = (g: BoardGame, from: string, to: string, promo?: 'Q' | 'R' | 'B' | 'N') => {
  const next = playMove(g, { from: parseSquare(from), to: parseSquare(to), promo });
  if (!next) throw new Error(`Illegal move ${from}-${to}`);
  return next;
};

console.log('\nEndings');
{
  // Fool's mate.
  let g = newBoardGame(startPosition());
  g = mv(g, 'f2', 'f3');
  g = mv(g, 'e7', 'e5');
  g = mv(g, 'g2', 'g4');
  g = mv(g, 'd8', 'h4');
  check(g.end?.reason === 'checkmate' && 'winner' in g.end && g.end.winner === 'b', "fool's mate is checkmate, Black wins");
  check(playMove(g, { from: parseSquare('a2'), to: parseSquare('a3') }) === null, 'no move after the game is over');
}
{
  // Stalemate: Black king a8, White queen to b6 with king c6... use a known one.
  let g = newBoardGame(fromFen('k7/8/1K6/8/8/8/8/2Q5 w - - 0 1'));
  g = mv(g, 'c1', 'c7');
  check(g.end?.reason === 'stalemate', 'stalemate (Qc7, Black king a8 has no move)');
}
{
  // Threefold repetition: knights out and back twice.
  let g = newBoardGame(startPosition());
  for (let i = 0; i < 2; i++) {
    g = mv(g, 'g1', 'f3');
    g = mv(g, 'g8', 'f6');
    g = mv(g, 'f3', 'g1');
    check(g.end === null, `no draw before the repetition is complete (round ${i + 1})`);
    g = mv(g, 'f6', 'g8');
  }
  check(g.end?.reason === 'repetition', 'threefold repetition ends the game by itself');
}
{
  // Castling rights are part of the position: the king stepping out and back
  // loses them, so the starting position "after" is not a repeat of the start.
  let g = newBoardGame(fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'));
  g = mv(g, 'e1', 'f1');
  g = mv(g, 'e8', 'f8');
  g = mv(g, 'f1', 'e1');
  g = mv(g, 'f8', 'e8');
  // Same pieces as the start, but without castling rights: first time this position occurs.
  g = mv(g, 'e1', 'f1');
  g = mv(g, 'e8', 'f8');
  g = mv(g, 'f1', 'e1');
  g = mv(g, 'f8', 'e8');
  check(g.end === null, 'positions with different castling rights are different positions');
  // Kings on f1 and f8, White to move, no rights: the third time comes now.
  g = mv(g, 'e1', 'f1');
  check(g.end === null, '...Kf1 with Black to move has only occurred twice without rights');
  g = mv(g, 'e8', 'f8');
  check(g.end?.reason === 'repetition', '...and Kf1/Kf8 without rights, a third time, is a repetition');
}
{
  // Fifty-move rule: 100 half-moves with no capture or pawn move.
  let g = newBoardGame(fromFen('8/8/8/8/8/8/R7/K6k w - - 98 80'));
  g = mv(g, 'a2', 'b2');
  check(g.end === null, 'no draw at 99 half-moves');
  g = mv(g, 'h1', 'g1');
  check(g.end?.reason === 'fifty', 'fifty-move rule at 100 half-moves');
}
{
  // Checkmate on the hundredth half-move stands.
  let g = newBoardGame(fromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80'));
  g = mv(g, 'a1', 'a8');
  check(g.end?.reason === 'checkmate', 'checkmate on the hundredth half-move is still checkmate');
}
{
  // En passant only counts for repetition when it can really be played.
  let g = newBoardGame(fromFen('4k3/8/8/8/4p3/8/3P4/4K3 w - - 0 1'));
  g = mv(g, 'd2', 'd4');
  check(legalMoves(g.pos).some((m) => m.enPassant), 'en passant is available after d2-d4 next to the e4 pawn');
  g = mv(g, 'e4', 'd3');
  check(g.pos.board[parseSquare('d4')] === null && g.pos.board[parseSquare('d3')]?.kind === 'P', 'en passant removes the passed pawn');
}
{
  // Promotion and underpromotion.
  let g = newBoardGame(fromFen('8/P6k/8/8/8/8/8/K7 w - - 0 1'));
  check(legalMoves(g.pos).filter((m) => m.from === parseSquare('a7')).length === 4, 'a pawn on the seventh rank has four promotion choices');
  g = mv(g, 'a7', 'a8', 'N');
  check(g.pos.board[parseSquare('a8')]?.kind === 'N', 'underpromotion to a knight');
}
{
  // Insufficient material.
  const dead = (fen: string) => deadPosition(fromFen(fen));
  check(dead('8/8/8/4k3/8/8/8/4K3 w - - 0 1'), 'K v K is dead');
  check(dead('8/8/8/4k3/8/8/8/2B1K3 w - - 0 1'), 'K+B v K is dead');
  check(dead('8/8/8/4k3/8/8/8/1N2K3 w - - 0 1'), 'K+N v K is dead');
  check(dead('8/8/8/2b1k3/8/8/8/2B1K3 w - - 0 1'), 'K+B v K+B, bishops on the same color, is dead');
  check(!dead('8/8/8/3bk3/8/8/8/2B1K3 w - - 0 1'), 'K+B v K+B, bishops on different colors, is not dead');
  check(!dead('8/8/8/4k3/8/8/8/1NN1K3 w - - 0 1'), 'K+N+N v K is not dead (mate is possible with help)');
  check(!dead('8/8/8/4k3/8/8/8/1N1BK3 w - - 0 1'), 'K+B+N v K is not dead');
  check(!dead('8/8/8/4k3/8/8/P7/4K3 w - - 0 1'), 'a pawn is never insufficient');
  let g = newBoardGame(fromFen('8/8/8/4k3/8/8/3r4/4K3 w - - 0 1'));
  g = mv(g, 'e1', 'd2');
  check(g.end?.reason === 'material', 'capturing the last rook leaves K v K: the game ends');
}
{
  // Timeout rule: does the side with time left have mating material of its own?
  const p = fromFen('8/8/8/4k3/8/8/8/1N2KQ2 w - - 0 1');
  check(!sideCannotMate(p, 'w'), 'K+N+Q can mate (timeout loses)');
  check(sideCannotMate(p, 'b'), 'a lone king cannot mate (timeout against it is a draw)');
  check(sideCannotMate(fromFen('8/8/8/4k3/8/8/8/1N2K3 w - - 0 1'), 'w'), 'K+N alone cannot mate');
}

// ---------------------------------------------------------------- Bastille

const variant = (fen: string, v: Variant, hole: number | null = null): Position => ({ ...fromFen(fen), variant: v, hole: hole === null ? null : { sq: hole, turns: 1 } });
const P = parseSquare;
const has = (pos: Position, from: string, to: string) => legalMoves(pos).some((m) => m.from === P(from) && m.to === P(to));

console.log('\nBastille');
{
  check(legalMoves(startPosition('bastille')).length === 20, 'Bastille start: 20 moves');
  const k = variant('8/8/8/8/3q4/8/8/4K3 w - - 0 1', 'bastille');
  check(has(k, 'e1', 'd2') && has(k, 'e1', 'e2'), 'the king may move onto attacked squares (no check)');
  const kc = variant('k7/8/8/8/8/8/8/R3K3 w - - 0 1', 'bastille');
  check(has(kc, 'a1', 'a8'), 'a king can be captured');
  let g = newBoardGame(variant('k7/3p4/8/8/8/3R4/8/4K3 w - - 0 1', 'bastille'));
  g = mv(g, 'd3', 'd7');
  check(g.end?.reason === 'palace' && 'winner' in g.end && g.end.winner === 'w', 'capturing the last piece in the black palace: White wins');
  g = newBoardGame(variant('k7/3p4/8/8/8/8/8/4K3 b - - 0 1', 'bastille'));
  g = mv(g, 'd7', 'd6');
  check(g.end?.reason === 'palace' && 'winner' in g.end && g.end.winner === 'w', 'emptying your own palace loses (self-inflicted)');
  g = newBoardGame(variant('k7/3p4/8/8/8/8/3Q4/K7 w - - 0 1', 'bastille'));
  g = mv(g, 'd2', 'd7');
  check(g.end?.reason === 'palaceBoth', 'one move emptying both palaces is a draw (an enemy piece in a palace does not count)');
  g = newBoardGame(variant('k7/3p4/8/8/8/8/8/R3K3 w - - 0 1', 'bastille'));
  g = mv(g, 'a1', 'a8');
  check(g.end === null, 'the game goes on after a king is captured');
  check(!deadPosition(g.pos) || g.end === null, 'insufficient material does not end a Bastille game');
  const castle = variant('4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'bastille');
  check(has(castle, 'e1', 'g1'), 'castling is allowed');
  const castleAtt = variant('4kr2/8/8/8/8/8/8/4K2R w K - 0 1', 'bastille');
  check(!has(castleAtt, 'e1', 'g1'), 'castling across an attacked square is not (orthodox limits kept)');
}

// ---------------------------------------------------------------- Pot-Hole

console.log('\nPot-Hole');
{
  check(legalMoves(variant(START_FEN, 'pothole')).length === 20, 'Pot-Hole start: 20 moves');
  const rook = variant('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'pothole', P('c1'));
  check(has(rook, 'a1', 'b1') && !has(rook, 'a1', 'c1') && !has(rook, 'a1', 'd1'), 'a rook can neither enter nor pass over the pothole');
  const knight = variant('4k3/8/8/8/8/8/1P6/1N2K3 w - - 0 1', 'pothole', P('b2'));
  check(has(knight, 'b1', 'c3') && has(knight, 'b1', 'a3'), 'a knight jumps over a pothole');
  const knightIn = variant('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1', 'pothole', P('c3'));
  check(!has(knightIn, 'b1', 'c3'), 'a knight cannot land in a pothole');
  const pawn = variant('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 'pothole', P('e3'));
  check(!has(pawn, 'e2', 'e3') && !has(pawn, 'e2', 'e4'), 'a pawn cannot step into or over a pothole');
  const pawn2 = variant('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 'pothole', P('e4'));
  check(has(pawn2, 'e2', 'e3') && !has(pawn2, 'e2', 'e4'), 'a pawn cannot double-step into a pothole');
  check(!inCheck(variant('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1', 'pothole', P('e4'))), 'a rook does not give check across a pothole');
  check(inCheck(variant('4k3/8/3N4/4p3/8/8/8/6K1 b - - 0 1', 'pothole', P('e7'))), 'a knight gives check over a pothole');
  check(!has(variant('4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'pothole', P('g1')), 'e1', 'g1'), 'no castling onto a pothole');
  check(!has(variant('4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'pothole', P('f1')), 'e1', 'g1'), 'no castling over a pothole');
  // A pothole can expose a king on the other side's turn; the king still cannot be captured.
  const exposed = { ...variant('4k3/8/8/8/8/8/8/r3K3 b - - 0 1', 'pothole') };
  check(!legalMoves(exposed).some((m) => m.captured?.kind === 'K'), 'a king exposed by a pothole cannot be captured');

  // The dice: a fixed sequence of numbers stands in for the host's random source.
  const seq = (xs: number[]) => {
    let i = 0;
    return () => xs[i++];
  };
  const start = startPosition('pothole');
  // d6 = 1 (odd): nothing opens.
  let r = potholeStep(start, 1, seq([0]), 'base');
  check(r.roll.opened === null && !r.pos.hole, 'an odd roll opens nothing');
  // d6 = 2 (even), lands on e1 (the white king: file 4, rank 0) → re-roll, lands on d2.
  r = potholeStep(start, 1, seq([1, 4, 0, 3, 1]), 'base');
  check(r.roll.tries.length === 2 && r.roll.opened === P('d2') && r.roll.removed?.kind === 'P', 'a pothole on a king is re-rolled; the piece on the new square falls in');
  check(r.pos.board[P('d2')] === null && r.pos.hole?.sq === P('d2') && r.pos.hole.turns === 1, 'the square is empty and blocked for one turn');
  const after = potholeStep(r.pos, 2, seq([0]), 'base');
  check(after.roll.closed === P('d2') && !after.pos.hole, 'the base pothole closes after the other player’s turn');
  const rnd = potholeStep(start, 1, seq([3, 2, 5, 3]), 'random');
  check(rnd.roll.turns === 4 && rnd.pos.hole?.turns === 4, 'random duration: a six-sided roll for 1 to 6 turns');
  const busy = potholeStep(rnd.pos, 2, seq([1]), 'random');
  check(busy.roll.opened === null && busy.pos.hole?.turns === 3, 'only one pothole at a time: an even roll while one is open opens nothing');
  check(repetitionKey(rnd.pos) !== repetitionKey({ ...rnd.pos, hole: { sq: rnd.pos.hole!.sq, turns: 2 } }), 'the pothole and its turns left are part of the position');
}

// ---------------------------------------------------------------- Mega Knight

console.log('\nMega Knight');
{
  const mkPos = (fen: string, mk: string[]): Position => ({ ...fromFen(fen), variant: 'megaknight', mk: mk.map(P) });
  const start = mkPos(START_FEN, ['d4']);
  check(legalMoves(start).length === 18 && !has(start, 'd2', 'd4') && !has(start, 'e2', 'e4'), 'start: the mega knight on d4-e5 blocks the d and e pawns’ double steps (18 moves)');
  const blocked = mkPos('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', ['b1']);
  check(!has(blocked, 'a1', 'b1') && !has(blocked, 'a1', 'd1') && has(blocked, 'a1', 'a5'), 'pieces cannot enter or pass the mega knight');
  check(has(mkPos('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1', ['b2']), 'b1', 'd2') && !has(mkPos('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1', ['c3']), 'b1', 'c3'), 'knights jump over it but cannot land on it');
  check(!inCheck(mkPos('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1', ['e4'])), 'it blocks a line of check');
  // Rolling.
  let g = newBoardGame(mkPos('4k3/8/8/8/8/8/8/4K3 w - - 0 1', ['d4']));
  const after3 = rollMega(g, 3);
  check(after3.pos.turn === 'b' && !after3.end, 'a roll of 1-5 does nothing and the turn passes');
  const after6 = rollMega(g, 6);
  check(after6.pos.mkRoll === true && after6.pos.turn === 'w' && legalMoves(after6.pos).every((m) => m.mk), 'a 6: the turn’s move is a mega knight move');
  // Crushing.
  g = newBoardGame(mkPos('4k3/8/8/8/8/8/2pp4/4K3 w - - 0 1', ['b3']));
  g = rollMega(g, 6);
  const crush = playMove(g, { from: P('b3'), to: P('c1'), mk: true });
  check(!!crush && crush.pos.board[P('c2')] === null && crush.pos.board[P('d2')] === null && crush.pos.mk!.includes(P('c1')), 'landing crushes every piece under the 2x2');
  g = newBoardGame(mkPos('8/8/8/8/8/3k4/8/K7 w - - 0 1', ['b4']));
  g = rollMega(g, 6);
  const kc = playMove(g, { from: P('b4'), to: P('c2'), mk: true });
  check(kc?.end?.reason === 'kingLost' && 'winner' in kc.end && kc.end.winner === 'w', 'a crushed king loses');
  // In check: a non-6 is checkmate; a 6 must get out of check.
  const chk = newBoardGame(mkPos('4k3/8/8/8/8/8/8/r3K3 w - - 0 1', ['g6']));
  check(rollMega(chk, 2).end?.reason === 'checkmate', 'in check, a roll that is not a 6 is checkmate');
  const chk6 = rollMega(chk, 6);
  check(chk6.end?.reason === 'checkmate', 'in check, a 6 with no mega knight move that resolves it is checkmate');
  const save = newBoardGame(mkPos('4k3/8/8/8/8/8/8/r3K3 w - - 0 1', ['b3']));
  const save6 = rollMega(save, 6);
  check(!save6.end && legalMoves(save6.pos).some((m) => m.to === P('a1')), 'in check, a 6 can crush the checking piece');
  // Mega knights capture each other only by covering all four squares.
  const two = mkPos('4k3/8/8/8/8/8/8/4K3 w - - 0 1', ['a1', 'b3']);
  const twoR = { ...two, mkRoll: true };
  check(legalMoves(twoR).some((m) => m.from === P('a1') && m.to === P('b3')) && !legalMoves(twoR).some((m) => m.from === P('a1') && m.to === P('c2')), 'a full overlap captures another mega knight; a partial one is not allowed');
  // Four knights in a 2x2.
  const f = formMegaKnights(mkPos('4k3/8/8/8/8/8/Nn6/Nn2K3 w - - 0 1', []));
  check(f.formed.length === 1 && f.pos.board[P('a1')] === null && f.pos.mk!.includes(P('a1')), 'four knights of any colors in a 2x2 become a mega knight');
}

// ---------------------------------------------------------------- Remorse

console.log('\nRemorse');
{
  const rp = (fen: string): Position => ({ ...fromFen(fen), variant: 'remorse', extra: null });
  const one = (n: number) => () => n;
  const capture = (pos: Position, from: string, to: string, d6: number) => {
    const m = findLegal(pos, { from: P(from), to: P(to) })!;
    return remorseStep(pos, play(pos, m), m, 1, one(d6 - 1));
  };
  const base = rp('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
  let r = capture(base, 'e4', 'd5', 1);
  check(r.pos.board[P('d5')]?.status === 'devastated', 'a 1: devastated');
  check(!legalMoves({ ...r.pos, turn: 'w' }).some((m) => m.from === P('d5')), 'a devastated piece cannot act');
  r = capture(base, 'e4', 'd5', 3);
  check(r.pos.board[P('d5')]?.status === 'guilt', 'a 2 or 3: guilt-ridden');
  r = capture(base, 'e4', 'd5', 5);
  check(!r.pos.board[P('d5')]?.status, 'a 4 or 5: unaffected');
  r = capture(base, 'e4', 'd5', 6);
  check(r.pos.board[P('d5')]?.status === 'psycho' && r.pos.turn === 'w' && r.pos.extra === P('d5'), 'a 6: psychopath, with an extra move at once');
  check(legalMoves(r.pos).every((m) => m.from === P('d5')), 'the extra move is by that piece only');
  const sk = skipExtra(r.pos, 1);
  check(sk.pos.turn === 'b' && sk.pos.extra === null, 'the extra move can be skipped');
  // Guilt-ridden pieces cannot capture and do not give check.
  const guilt = rp('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
  guilt.board[P('a1')] = { ...guilt.board[P('a1')]!, status: 'guilt' };
  check(!inCheck({ ...guilt, turn: 'b', board: (() => { const b = guilt.board.slice(); b[P('a8')] = b[P('a1')]; b[P('a1')] = null; return b; })() }), 'a guilt-ridden piece does not give check');
  // Devastated: self-captures after three of its owner's turns.
  r = capture(base, 'e4', 'd5', 1);
  let pos = { ...r.pos };
  const ownerTurn = (p: Position) => skipExtra({ ...p, turn: 'w' }, 1).pos;
  pos = ownerTurn(pos);
  check(!!pos.board[P('d5')], 'still there after one more turn');
  pos = ownerTurn(pos);
  pos = ownerTurn(pos);
  check(pos.board[P('d5')] === null, '...gone after its owner’s third turn');
  // Bloodlust after three psychopath captures; it can only move to capture, friendly pieces included.
  const bl = rp('4k3/8/8/2p1p3/3P4/8/8/4K3 w - - 0 1');
  bl.board[P('d4')] = { ...bl.board[P('d4')]!, status: 'psycho', kills: 2 };
  r = capture(bl, 'd4', 'e5', 6);
  check(r.pos.board[P('e5')]?.status === 'bloodlust', 'the third capture as a psychopath brings bloodlust');
  const bl2 = rp('4k3/8/8/8/8/8/3PN3/4K3 w - - 0 1');
  bl2.board[P('d2')] = { ...bl2.board[P('d2')]!, status: 'bloodlust', kills: 3 };
  bl2.board[P('e2')] = { ...bl2.board[P('e2')]!, kind: 'N' };
  const blMoves = legalMoves(bl2).filter((m) => m.from === P('d2'));
  check(blMoves.length === 0, 'with nothing to capture, a bloodlust piece cannot move');
  const bl3 = rp('4k3/8/8/8/8/4N3/3P4/6K1 w - - 0 1');
  bl3.board[P('d2')] = { ...bl3.board[P('d2')]!, status: 'bloodlust', kills: 3 };
  check(legalMoves(bl3).some((m) => m.from === P('d2') && m.to === P('e3')), 'a bloodlust pawn can capture a friendly piece');
  // Absolving: a bishop moving next to an afflicted piece clears it.
  const ab = rp('4k3/8/8/8/8/8/3P4/1B2K3 w - - 0 1');
  ab.board[P('d2')] = { ...ab.board[P('d2')]!, status: 'devastated', due: 3 };
  const am = findLegal(ab, { from: P('b1'), to: P('c2') })!;
  const abs = remorseStep(ab, play(ab, am), am, 1, one(0));
  check(!abs.pos.board[P('d2')]?.status && abs.ev.absolved.includes(P('d2')), 'a bishop moving next to it absolves the piece');
  // A devastated king that captures itself loses.
  const dk = rp('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
  dk.board[P('e1')] = { ...dk.board[P('e1')]!, status: 'devastated', due: 1 };
  const gone = skipExtra({ ...dk }, 1).pos;
  const end = newBoardGame(gone).end;
  check(end?.reason === 'kingLost' && 'winner' in end && end.winner === 'b', 'a devastated king that captures itself loses');
}

// ---------------------------------------------------------------- Bario

console.log('\nBario');
{
  const bp = (fen: string, promos = { w: 0, b: 0 }): Position => {
    const pos = fromFen(fen);
    return { ...pos, variant: 'bario', board: pos.board.map((p) => (p && p.kind === 'X' ? { ...p, quantum: true } : p)), bario: { promos, cycles: { w: 0, b: 0 } } };
  };
  const startB = bp('xxxxkxxx/pppppppp/8/8/8/8/PPPPPPPP/XXXXKXXX w KQkq - 0 1');
  const ms = legalMoves(startB);
  check(ms.some((m) => m.from === P('b1') && m.to === P('c3') && m.define === 'N'), 'an undefined Quantum can move as a knight (becoming one)');
  check(ms.filter((m) => !m.define).length === 16, 'start: 16 pawn moves, the rest are Quantum moves with a chosen type');
  let g = newBoardGame(startB);
  g = playMove(g, { from: P('b1'), to: P('c3'), define: 'N' })!;
  check(g.pos.board[P('c3')]?.kind === 'N' && g.pos.board[P('c3')]?.quantum === true, 'it becomes a knight and stays one');
  // Caps: with both knights defined, no Quantum can become a knight.
  const two = bp('4k3/8/8/8/8/8/8/XN2KN1X w - - 0 1');
  two.board[P('b1')] = { ...two.board[P('b1')]!, quantum: true };
  two.board[P('f1')] = { ...two.board[P('f1')]!, quantum: true };
  check(!quantumAvail(two, 'w')!.has('N') && !legalMoves(two).some((m) => m.define === 'N'), 'both knights used: no Quantum may become a knight this cycle');
  check(quantumAvail(bp('4k3/8/8/8/8/8/8/XN2KN1X w - - 0 1', { w: 1, b: 0 }), 'w')!.size === 4, 'a promotion raises every cap by 1');
  // Cycle: defining the last undefined Quantum turns all defined ones back to undefined.
  const last = bp('4k3/8/8/8/8/8/8/X3K3 w - - 0 1');
  last.board[P('a1')] = { id: 99, color: 'w', kind: 'X', quantum: true };
  last.board[P('h2')] = { id: 98, color: 'w', kind: 'R', quantum: true };
  g = playMove(newBoardGame(last), { from: P('a1'), to: P('a5'), define: 'R' })!;
  check(g.pos.board[P('a5')]?.kind === 'X' && g.pos.board[P('h2')]?.kind === 'X' && g.pos.bario!.cycles.w === 1, 'the last definition ends the cycle: every defined Quantum becomes undefined again');
  // Check: an undefined Quantum gives check if an available type could attack.
  check(inCheck(bp('4k3/8/8/8/8/8/8/4X1K1 b - - 0 1')), 'an undefined Quantum on the king’s file gives check (it could be a rook or queen)');
  const noLines = bp('4k3/8/8/8/8/8/8/4X1K1 b - - 0 1');
  noLines.board[P('a2')] = { id: 90, color: 'w', kind: 'R', quantum: true };
  noLines.board[P('b2')] = { id: 91, color: 'w', kind: 'R', quantum: true };
  noLines.board[P('c2')] = { id: 92, color: 'w', kind: 'Q', quantum: true };
  check(!inCheck(noLines), '...but not once rooks and the queen are used up this cycle');
  // Castling with an undefined Quantum on the rook's square: it becomes a rook.
  g = newBoardGame(bp('4k3/8/8/8/8/8/8/4K2X w K - 0 1'));
  g = playMove(g, { from: P('e1'), to: P('g1'), define: 'R' })!;
  check(!!g && g.pos.board[P('f1')]?.kind !== undefined && g.pos.board[P('g1')]?.kind === 'K', 'castling with a Quantum, which turns into a rook');
  // Promotion: anything, and the caps rise.
  g = playMove(newBoardGame(bp('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')), { from: P('a7'), to: P('a8'), promo: 'N' })!;
  check(g.pos.board[P('a8')]?.kind === 'N' && !g.pos.board[P('a8')]?.quantum && g.pos.bario!.promos.w === 1, 'a promotion is a fixed piece and raises the caps');
  check(newBoardGame(bp('4k3/8/8/8/8/8/8/4K1X1 w - - 0 1')).end === null && newBoardGame(bp('4k3/8/8/8/8/8/8/4K3 w - - 0 1')).end?.reason === 'material', 'insufficient material only for king against king');
}

// ---------------------------------------------------------------- Rental

console.log('\nRental');
{
  check(squareRent(P('a1')) === 1 && squareRent(P('d4')) === 4 && squareRent(P('c3')) === 2, 'rent: edge 1, centre 4, others 2');
  const st = rentalStart({ ...startPosition('rental') });
  check(st.rental!.treasury.w === 48 && st.rental!.treasury.b === 0, 'White receives its first income (16 units x 3) before moving');
  check(rentFor(st, 'w', 0) === 22 && rentFor(st, 'w', 4) === 22 && rentFor(st, 'w', 5) === 38 && rentFor(st, 'w', 10) === 54, 'the start position costs White 22 (10 edge squares, 6 others); +1 a square after 5 rounds, +2 after 10');
  let g = newBoardGame(st);
  const m1 = findLegal(g.pos, { from: P('e2'), to: P('e4') })!;
  const after = rentalAfterMove(g.pos, play(g.pos, m1));
  check(after.pos.rental!.treasury.w === 48 - 24 && after.pos.rental!.treasury.b === 48 && after.pos.turn === 'b', 'e4 (a centre square, 4): White pays 24, Black receives 48');
  // Cannot pay: units are given up until it can.
  const poor = { ...fromFen('4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1'), variant: 'rental' as const, rental: { treasury: { w: 2, b: 10 }, owed: null } };
  const pm = findLegal(poor, { from: P('d4'), to: P('d5') })!;
  const owe = rentalAfterMove(poor, play(poor, pm));
  check(owe.pos.rental!.owed === 5 && owe.pos.turn === 'w' && legalMoves(owe.pos).length === 0, 'rent it cannot pay is owed, and the player must give up units');
  const ev = evict(owe.pos, P('d5'))!;
  check(ev.pos.rental!.owed === null && ev.pos.rental!.treasury.w === 1 && ev.pos.turn === 'b', 'giving up the queen makes the rent payable; the turn passes');
  check(newBoardGame(ev.pos).end?.reason === 'treasury', '...and with kings only the smaller treasury loses');
  const broke = { ...fromFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), variant: 'rental' as const, rental: { treasury: { w: 0, b: 10 }, owed: 1 } };
  const be = newBoardGame(broke).end;
  check(be?.reason === 'bankrupt' && 'winner' in be && be.winner === 'b', 'owing rent with only the king left is bankruptcy');
  g = newBoardGame({ ...st, board: st.board.map((p) => (p?.kind === 'K' ? p : null)), rental: { treasury: { w: 5, b: 5 }, owed: null } });
  check(g.end?.reason === 'treasuryTie', 'kings only with equal treasuries: a draw');
}

// ---------------------------------------------------------------- Revival

console.log('\nRevival');
{
  const rv = (fen: string, aux: Record<string, string> = {}): Position => {
    const pos = revivalStart(fromFen(fen));
    const a = pos.revival!.aux.slice();
    for (const [sqn, code] of Object.entries(aux)) a[P(sqn)] = { id: 500 + P(sqn), color: code[0] as 'w' | 'b', kind: code[1] as 'P', ...(code[2] === '+' ? { promoted: true } : {}) };
    return { ...pos, revival: { ...pos.revival!, aux: a } };
  };
  const mvR = (pos: Position, from: string, to: string, board: 'main' | 'aux' = 'main') => {
    const m = findLegal(pos, { from: P(from), to: P(to), board });
    if (!m) throw new Error(`Illegal ${board} ${from}-${to}`);
    return playRevival(pos, m);
  };
  let p = revivalStart(startPosition());
  check(legalMoves(p).length === 20, 'start: 20 main-board moves, nothing on the auxiliary board');
  let r = mvR(p, 'e2', 'e4');
  check(r.pos.turn === 'b', 'with nothing on the auxiliary board, its move is skipped and the turn passes');
  // A main-board capture sends the piece to the auxiliary board; its owner chooses among free squares.
  p = rv('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
  r = mvR(p, 'e4', 'd5');
  check(r.pos.revival!.queue.length === 1 && r.pos.revival!.queue[0].owner === 'b' && r.pos.revival!.queue[0].options.length === 8, 'a captured black pawn waits for Black to choose a square on its second rank (aux board)');
  const placed = choose(r.pos, P('d7'))!;
  check(placed.pos.revival!.aux[P('d7')]?.kind === 'P' && placed.pos.turn === 'b', 'placed on d7 of the auxiliary board; then it is Black’s turn');
  // One free starting square: placed at once.
  p = rv('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
  p = { ...p, board: (() => { const b = p.board.slice(); b[P('a8')] = { id: 77, color: 'b', kind: 'Q' }; return b; })() };
  r = mvR(p, 'a1', 'a8');
  check(r.pos.revival!.aux[P('d8')]?.kind === 'Q' && r.pos.revival!.queue.length === 0, 'a captured queen spawns on d8 of the auxiliary board at once (one starting square)');
  // A capture on the auxiliary board: the victim is gone, the capturer respawns on the main board.
  p = rv('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', { e4: 'wN', d6: 'bP' });
  p = { ...p, revival: { ...p.revival!, mainDone: true } };
  r = mvR(p, 'e4', 'd6', 'aux');
  check(r.pos.revival!.aux[P('d6')] === null && r.transfers.some((t) => t.gone) && r.pos.revival!.queue.length === 1 && r.pos.revival!.queue[0].options.join() === [P('b1'), P('g1')].join(), 'aux capture: the victim is gone; the knight waits for White to choose b1 or g1 on the main board');
  const back = choose(r.pos, P('g1'));
  check(!!back && back.pos.board[P('g1')]?.kind === 'N', 'White puts the knight back on g1 of the main board');
  // Blocked respawn: a piece on a starting square is removed to make room (and, from the main board, goes to the auxiliary board).
  p = rv('4k3/8/8/8/8/8/8/1n2K1n1 w - - 0 1', { e4: 'wN', d6: 'bP' });
  p = { ...p, revival: { ...p.revival!, mainDone: true } };
  r = mvR(p, 'e4', 'd6', 'aux');
  const q = r.pos.revival!.queue[0];
  check(q?.mode === 'displace' && q.options.length === 2 && q.owner === 'w', 'both knight squares taken: White chooses which piece to remove');
  const d = choose(r.pos, P('b1'))!;
  check(d.pos.board[P('b1')]?.color === 'w' && d.pos.revival!.queue.length === 1 && d.pos.revival!.queue[0].owner === 'b', 'the removed black knight counts as captured: it goes to the auxiliary board, Black chooses');
  check(startSquares({ id: 1, color: 'w', kind: 'B' }, true).length === 1 && startSquares({ id: 1, color: 'w', kind: 'Q', promoted: true }, false).length === 8, 'bishops keep their colour; promoted pieces respawn on the second rank');
  // Check is on the main board only; checkmate ends it.
  p = rv('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  r = mvR(p, 'a1', 'a8');
  check(newBoardGame(r.pos).end?.reason === 'checkmate', 'checkmate on the main board ends the game');
}

console.log(failed ? '\nSome checks FAILED' : '\nAll checks passed');
process.exit(failed ? 1 : 0);
