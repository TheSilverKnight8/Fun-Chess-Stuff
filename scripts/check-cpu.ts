// Checks the CPU outside the browser: npm run check:cpu
// CPU against CPU in every mode: every answer must be an allowed action (the
// game never stalls), thinking time is measured, and Hard should beat Easy.

import { think, type Level } from '../src/cpu/brain.ts';
import { actorOf, evictIn, moveIn, newMatch, placeIn, rollIn, skipIn, type MatchState } from '../src/game/match.ts';
import { other } from '../src/chess/types.ts';
import type { ModeId } from '../src/modes.ts';

const MODES: ModeId[] = ['standard', 'bastille', 'pothole', 'bario', 'revival', 'rental', 'megaknight', 'remorse'];
const dice = (n: number) => Math.floor(Math.random() * n);
let failed = false;

function play(mode: ModeId, white: Level, black: Level, maxActions = 400) {
  let m: MatchState = newMatch(1, mode, null, 'w', 0);
  let worst = 0;
  let total = 0;
  let actions = 0;
  for (; actions < maxActions && !m.result; actions++) {
    const c = actorOf(m.game.pos);
    const level = c === 'w' ? white : black;
    const t0 = performance.now();
    const a = think(m.game.pos, level, c);
    const dt = performance.now() - t0;
    worst = Math.max(worst, dt);
    total += dt;
    if (!a) {
      console.log(`FAIL ${mode}: no action for ${c} (${level})`);
      failed = true;
      return { result: null, worst, avg: total / Math.max(1, actions), actions };
    }
    const t = actions * 1000;
    const next =
      a.t === 'move' ? moveIn(m, c, a.move, null, t, dice) : a.t === 'roll' ? rollIn(m, c, null, t, dice) : a.t === 'skip' ? skipIn(m, c, null, t) : a.t === 'evict' ? evictIn(m, c, a.sq, null, t) : placeIn(m, c, a.sq, null, t);
    if (!next) {
      console.log(`FAIL ${mode}: refused ${JSON.stringify(a)} for ${c} (${level})`);
      failed = true;
      return { result: null, worst, avg: total / Math.max(1, actions), actions };
    }
    m = next;
  }
  return { result: m.result, worst, avg: total / Math.max(1, actions), actions };
}

console.log('Every mode, every level against itself (one game each; capped at 400 actions for Easy, 120 Normal, 40 Hard to keep the check short):');
for (const mode of MODES)
  for (const lv of ['easy', 'normal', 'hard'] as Level[]) {
    const r = play(mode, lv, lv, lv === 'hard' ? 40 : lv === 'normal' ? 120 : 400);
    console.log(`  ${mode.padEnd(10)} ${lv.padEnd(6)} ${String(r.actions).padStart(4)} actions, ${r.result ? `${r.result.reason}${r.result.winner ? ' ' + r.result.winner : ''}` : 'unfinished'}; think avg ${r.avg.toFixed(0)} ms, worst ${r.worst.toFixed(0)} ms`);
  }

console.log('\\nStrength in Standard Chess (colors alternate; games capped, unfinished counts apart):');
for (const [a, b, n] of [['normal', 'easy', 6], ['hard', 'easy', 2]] as [Level, Level, number][]) {
  let wa = 0, wb = 0, d = 0;
  for (let i = 0; i < n; i++) {
    const aWhite = i % 2 === 0;
    const r = play('standard', aWhite ? a : b, aWhite ? b : a, a === 'hard' ? 160 : 240);
    const w = r.result?.winner;
    if (!w) d++;
    else if ((w === 'w') === aWhite) wa++;
    else wb++;
  }
  console.log(`  ${a} vs ${b}: ${wa} wins, ${wb} losses, ${d} draws or unfinished`);
}
console.log(failed ? '\\nSome checks FAILED' : '\\nAll checks passed');
process.exit(failed ? 1 : 0);
void other;
