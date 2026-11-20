import { getAudio } from './engine';

// Sound effects, made on the spot from oscillators and noise (spec section 5:
// sound made by code, no audio files). Each one is a few short notes or bursts.

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface ToneOpts {
  type?: OscillatorType;
  at?: number;
  dur?: number;
  gain?: number;
  /** End pitch for a slide, in Hz. */
  to?: number;
  attack?: number;
}

function tone(hz: number, o: ToneOpts = {}) {
  const a = getAudio();
  if (!a) return;
  const { ctx, effects } = a;
  const t = ctx.currentTime + (o.at ?? 0);
  const dur = o.dur ?? 0.12;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(hz, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const peak = o.gain ?? 0.18;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(effects);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

interface NoiseOpts {
  at?: number;
  dur?: number;
  gain?: number;
  filter?: BiquadFilterType;
  hz?: number;
  /** End filter frequency for a sweep. */
  toHz?: number;
  q?: number;
}

function noise(o: NoiseOpts = {}) {
  const a = getAudio();
  if (!a) return;
  const { ctx, effects } = a;
  const t = ctx.currentTime + (o.at ?? 0);
  const dur = o.dur ?? 0.08;
  const src = ctx.createBufferSource();
  src.buffer = a.noise;
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.frequency.setValueAtTime(o.hz ?? 2000, t);
  if (o.toHz) f.frequency.exponentialRampToValueAtTime(o.toHz, t + dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(effects);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

const notes = (ms: number[], o: ToneOpts & { step: number }) => ms.forEach((m, i) => tone(midiHz(m), { ...o, at: (o.at ?? 0) + i * o.step }));

/** A wooden piece set down on the board. */
function clack(at = 0, pitch = 1, gain = 1) {
  noise({ at, filter: 'bandpass', hz: 1500 * pitch, q: 2.5, dur: 0.05, gain: 0.5 * gain });
  tone(230 * pitch, { at, type: 'triangle', to: 170 * pitch, dur: 0.07, gain: 0.32 * gain, attack: 0.002 });
}

export const sfx = {
  /** Menu buttons. */
  click() {
    tone(midiHz(84), { type: 'square', dur: 0.05, gain: 0.07 });
  },
  /** A move with nothing captured. */
  move() {
    clack();
  },
  /** Castling: king and rook, one after the other, the second heavier. */
  castle() {
    clack(0, 1.05);
    clack(0.09, 0.82, 1.2);
    noise({ at: 0.09, filter: 'highpass', hz: 4000, dur: 0.05, gain: 0.12 });
  },
  /** A capture. Heavier for a more valuable piece (pawn 1 … queen 9). */
  capture(value: number) {
    const w = Math.min(1, value / 9);
    clack(0, 0.9, 1.1);
    noise({ filter: 'lowpass', hz: 900 + w * 600, dur: 0.14 + w * 0.25, gain: 0.45 + w * 0.3 });
    tone(170 + w * 40, { type: 'sawtooth', to: 45, dur: 0.14 + w * 0.3, gain: 0.16 + w * 0.12 });
    // The crack of shattering pieces.
    for (let i = 0; i < 2 + Math.round(w * 5); i++) noise({ at: 0.015 + i * 0.03, filter: 'highpass', hz: 3500 + i * 400, dur: 0.035, gain: 0.12 + w * 0.06 });
    if (value >= 5) tone(55, { type: 'sine', to: 30, dur: 0.5, gain: 0.35 });
  },
  /** Check: a sharp alarm sting. */
  check() {
    notes([88, 83, 88], { type: 'square', step: 0.07, dur: 0.1, gain: 0.08 });
    tone(330, { type: 'sawtooth', to: 880, dur: 0.22, gain: 0.07 });
    noise({ filter: 'highpass', hz: 5000, dur: 0.18, gain: 0.1 });
  },
  /** The checkmate impact. */
  mateHit() {
    tone(120, { type: 'sine', to: 28, dur: 0.9, gain: 0.5 });
    tone(220, { type: 'sawtooth', to: 40, dur: 0.6, gain: 0.2 });
    noise({ filter: 'lowpass', hz: 1200, toHz: 200, dur: 0.7, gain: 0.7 });
    noise({ at: 0.02, filter: 'highpass', hz: 3000, dur: 1.1, gain: 0.2 });
  },
  /** Checkmate on the winner's screen: a short brass fanfare. */
  fanfare() {
    notes([60, 64, 67, 72], { type: 'square', step: 0.11, dur: 0.16, gain: 0.1, at: 0.45 });
    notes([67, 72, 76], { type: 'sawtooth', step: 0, dur: 0.9, gain: 0.05, at: 0.9 });
    notes([79, 84], { type: 'square', step: 0.11, dur: 0.6, gain: 0.08, at: 0.9 });
    tone(midiHz(36), { type: 'triangle', at: 0.9, dur: 1, gain: 0.25 });
  },
  /** Checkmate on the loser's screen: a low falling sting. */
  mateLost() {
    notes([67, 63, 60, 55], { type: 'sawtooth', step: 0.2, dur: 0.32, gain: 0.07, at: 0.45 });
    tone(midiHz(31), { type: 'triangle', at: 1.2, dur: 1.1, gain: 0.3 });
  },
  /** Any other win. */
  win() {
    notes([72, 76, 79, 84], { type: 'square', step: 0.08, dur: 0.15, gain: 0.09 });
    tone(midiHz(48), { type: 'triangle', at: 0.24, dur: 0.5, gain: 0.2 });
  },
  /** Any other loss. */
  lose() {
    notes([69, 65, 62], { type: 'square', step: 0.14, dur: 0.22, gain: 0.08 });
    tone(midiHz(38), { type: 'triangle', at: 0.3, dur: 0.6, gain: 0.22 });
  },
  /** Any draw: a neutral, hanging chord. */
  draw() {
    notes([62, 67, 72], { type: 'triangle', step: 0.06, dur: 0.9, gain: 0.12 });
    notes([69, 74], { type: 'square', step: 0.06, dur: 0.7, gain: 0.04, at: 0.12 });
  },
  /** Promotion: a rising arpeggio with a shimmer on top. */
  promote() {
    notes([60, 64, 67, 72, 76, 79, 84], { type: 'square', step: 0.045, dur: 0.12, gain: 0.07 });
    noise({ at: 0.25, filter: 'highpass', hz: 6000, toHz: 9000, dur: 0.4, gain: 0.12 });
    tone(midiHz(88), { type: 'triangle', at: 0.32, dur: 0.5, gain: 0.12 });
  },
  /** The game starts. */
  start() {
    noise({ filter: 'bandpass', hz: 600, toHz: 4000, dur: 0.35, gain: 0.25, q: 0.7 });
    notes([67, 74, 79], { type: 'triangle', step: 0.09, dur: 0.3, gain: 0.16, at: 0.15 });
  },
  /** One second gone on your own clock in the last ten seconds. */
  tick() {
    tone(midiHz(96), { type: 'square', dur: 0.025, gain: 0.06 });
    noise({ filter: 'highpass', hz: 6000, dur: 0.02, gain: 0.08 });
  },
  /** A clock reaches zero. */
  buzzer() {
    tone(110, { type: 'sawtooth', dur: 0.55, gain: 0.16 });
    tone(116, { type: 'square', dur: 0.55, gain: 0.08 });
    noise({ filter: 'highpass', hz: 2500, dur: 0.25, gain: 0.2 });
  },
  /** A king tipping over (resignation). */
  topple() {
    noise({ at: 0.55, filter: 'lowpass', hz: 700, dur: 0.18, gain: 0.5 });
    tone(150, { at: 0.55, type: 'triangle', to: 70, dur: 0.2, gain: 0.3 });
    clack(0.78, 0.8, 0.6);
  },
  /** Pot-Hole: dice tumbling (the eight-sided ones a little higher). */
  dice(small = false) {
    for (let i = 0; i < 7; i++) {
      noise({ at: i * 0.05 + Math.random() * 0.02, filter: 'bandpass', hz: (small ? 3200 : 2200) + Math.random() * 800, q: 4, dur: 0.03, gain: 0.22 });
      tone((small ? 900 : 600) + Math.random() * 300, { at: i * 0.05, type: 'triangle', dur: 0.03, gain: 0.05 });
    }
  },
  /** A die comes to rest: brighter on an even roll. */
  diceLand(even: boolean) {
    clack(0, even ? 1.4 : 0.8, 0.9);
    if (even) tone(midiHz(84), { at: 0.04, type: 'triangle', dur: 0.15, gain: 0.1 });
  },
  /** The pothole landed on a king: re-roll. */
  reroll() {
    notes([76, 71], { type: 'square', step: 0.08, dur: 0.1, gain: 0.08 });
  },
  /** A pothole cracks open: a crack and a rumble. */
  crack() {
    noise({ filter: 'highpass', hz: 2500, dur: 0.12, gain: 0.35 });
    noise({ at: 0.03, filter: 'lowpass', hz: 300, dur: 0.6, gain: 0.6 });
    tone(70, { type: 'sine', to: 35, dur: 0.6, gain: 0.35 });
  },
  /** A piece falls into the pothole: a falling whistle, then a distant thud. */
  fall() {
    tone(1400, { type: 'sine', to: 300, dur: 0.45, gain: 0.07 });
    noise({ at: 0.46, filter: 'lowpass', hz: 400, dur: 0.2, gain: 0.4 });
    tone(90, { at: 0.46, type: 'sine', to: 50, dur: 0.25, gain: 0.25 });
  },
  /** A pothole is patched over. */
  patch() {
    noise({ filter: 'lowpass', hz: 900, dur: 0.15, gain: 0.5 });
    tone(140, { type: 'triangle', to: 90, dur: 0.12, gain: 0.25 });
    noise({ at: 0.05, filter: 'highpass', hz: 3000, dur: 0.2, gain: 0.1 });
  },
  /** Bastille: a palace's walls crumble. */
  crumble() {
    tone(80, { type: 'sine', to: 30, dur: 1, gain: 0.45 });
    for (let i = 0; i < 10; i++) noise({ at: i * 0.07 + Math.random() * 0.04, filter: 'bandpass', hz: 600 + Math.random() * 1400, q: 1.5, dur: 0.12, gain: 0.3 });
    noise({ filter: 'lowpass', hz: 700, toHz: 150, dur: 1.2, gain: 0.5 });
  },
  /** Bastille: a captured king's crown flies off. */
  crown() {
    notes([88, 91, 96], { type: 'triangle', step: 0.05, dur: 0.25, gain: 0.1 });
  },
  /** Mega Knight: a 6! */
  six() {
    clack(0, 1.5, 1);
    notes([72, 79, 84], { type: 'square', step: 0.06, dur: 0.18, gain: 0.1, at: 0.05 });
    tone(60, { type: 'sine', to: 40, dur: 0.4, gain: 0.3 });
  },
  /** Mega Knight: the mega knight lands, a huge footfall. */
  mkLand() {
    tone(65, { type: 'sine', to: 25, dur: 0.8, gain: 0.6 });
    noise({ filter: 'lowpass', hz: 500, toHz: 120, dur: 0.6, gain: 0.7 });
    noise({ at: 0.02, filter: 'bandpass', hz: 1500, dur: 0.25, gain: 0.25 });
  },
  /** Mega Knight: four knights become one. */
  form() {
    tone(200, { type: 'sawtooth', to: 900, dur: 0.5, gain: 0.08 });
    notes([60, 67, 72, 79], { type: 'square', step: 0.07, dur: 0.2, gain: 0.08, at: 0.35 });
    tone(55, { at: 0.6, type: 'sine', to: 30, dur: 0.6, gain: 0.45 });
  },
  /** Remorse: the sound of the status a capture rolled. */
  status(s: string | null) {
    if (s === 'devastated') {
      tone(220, { type: 'sawtooth', to: 70, dur: 1, gain: 0.1 });
      tone(110, { type: 'triangle', to: 55, dur: 1, gain: 0.18 });
    } else if (s === 'guilt') notes([71, 69, 67, 64], { type: 'triangle', step: 0.14, dur: 0.22, gain: 0.13 });
    else if (s === 'psycho') {
      notes([84, 85, 84, 85], { type: 'sawtooth', step: 0.05, dur: 0.08, gain: 0.07 });
      noise({ filter: 'highpass', hz: 4000, dur: 0.3, gain: 0.15 });
    } else if (s === 'bloodlust') {
      tone(90, { type: 'sawtooth', to: 50, dur: 0.9, gain: 0.2 });
      noise({ filter: 'bandpass', hz: 400, toHz: 150, q: 3, dur: 0.9, gain: 0.5 });
      notes([60, 61, 60], { type: 'square', step: 0.12, dur: 0.15, gain: 0.08, at: 0.2 });
    } else notes([72], { type: 'triangle', step: 0, dur: 0.12, gain: 0.1 });
  },
  /** Remorse: a bishop absolves. */
  halo() {
    notes([79, 83, 86, 91], { type: 'triangle', step: 0.07, dur: 0.6, gain: 0.08 });
    noise({ at: 0.1, filter: 'highpass', hz: 7000, dur: 0.6, gain: 0.06 });
  },
  /** Remorse: a devastated piece captures itself, a slow collapse. */
  collapse() {
    tone(180, { type: 'triangle', to: 60, dur: 1.1, gain: 0.2 });
    noise({ at: 0.6, filter: 'lowpass', hz: 600, dur: 0.4, gain: 0.4 });
  },
  /** Bario: a Quantum takes its shape, a shimmering morph. */
  define() {
    tone(330, { type: 'sine', to: 990, dur: 0.35, gain: 0.12 });
    notes([79, 86], { type: 'triangle', step: 0.08, dur: 0.3, gain: 0.08, at: 0.2 });
  },
  /** Bario: a cycle ends and the Quantums come undone. */
  cycle() {
    tone(1200, { type: 'sine', to: 200, dur: 0.8, gain: 0.12 });
    noise({ filter: 'bandpass', hz: 3000, toHz: 400, dur: 0.8, gain: 0.15 });
  },
  /** Rental: rent paid, a cash register. */
  register() {
    tone(midiHz(96), { type: 'triangle', dur: 0.35, gain: 0.1 });
    noise({ filter: 'bandpass', hz: 2500, dur: 0.08, gain: 0.25 });
    noise({ at: 0.1, filter: 'highpass', hz: 5000, dur: 0.12, gain: 0.12 });
  },
  /** Rental: income, a little shower of coins. */
  coins() {
    for (let i = 0; i < 6; i++) tone(midiHz(93 + (i % 3) * 2), { at: i * 0.05, type: 'triangle', dur: 0.12, gain: 0.06 });
  },
  /** Rental: the rent cannot be paid. */
  owed() {
    notes([67, 63], { type: 'square', step: 0.15, dur: 0.22, gain: 0.09 });
  },
  /** Revival: the view flips to the other board. */
  flip() {
    noise({ filter: 'bandpass', hz: 600, toHz: 3000, q: 0.7, dur: 0.35, gain: 0.25 });
    tone(220, { type: 'sine', to: 440, dur: 0.3, gain: 0.08 });
  },
  /** Revival: a piece leaves its board, rising away. */
  leave() {
    tone(500, { type: 'triangle', to: 1500, dur: 0.5, gain: 0.1 });
    noise({ filter: 'highpass', hz: 4000, toHz: 8000, dur: 0.5, gain: 0.08 });
  },
  /** Revival: a piece arrives in a beam of light. */
  enter() {
    notes([84, 79, 72], { type: 'triangle', step: 0.07, dur: 0.3, gain: 0.1 });
    tone(110, { at: 0.2, type: 'sine', to: 70, dur: 0.3, gain: 0.25 });
  },
  /** Manual: a page turning (a paper swish). */
  pageTurn() {
    noise({ filter: 'bandpass', hz: 1800, toHz: 4500, q: 0.8, dur: 0.28, gain: 0.22 });
    noise({ at: 0.22, filter: 'highpass', hz: 3000, dur: 0.06, gain: 0.12 });
  },
  /** Manual: the book drops in and lands. */
  bookOpen() {
    noise({ filter: 'bandpass', hz: 900, toHz: 2400, dur: 0.3, gain: 0.15 });
    clack(0.42, 0.7, 0.8);
  },
  /** Manual: the book lifts away. */
  bookClose() {
    noise({ filter: 'bandpass', hz: 2400, toHz: 800, dur: 0.3, gain: 0.15 });
  },
  /** The opponent offers a draw. */
  offer() {
    notes([76, 81], { type: 'triangle', step: 0.12, dur: 0.25, gain: 0.15 });
  },
  /** Someone came into the room. */
  join() {
    notes([72, 79], { type: 'square', step: 0.09, dur: 0.12, gain: 0.08 });
  },
  /** A connection was lost. */
  lost() {
    notes([74, 67], { type: 'square', step: 0.12, dur: 0.18, gain: 0.08 });
  },
  /** A lost connection came back. */
  back() {
    notes([67, 74], { type: 'square', step: 0.1, dur: 0.14, gain: 0.08 });
  },
};

/** Piece values for how hard a capture hits. */
export const PIECE_VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 12, X: 4 } as const;
