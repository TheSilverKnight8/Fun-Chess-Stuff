import { getAudio, whenAudioStarts } from './engine';

// Background music: short looping tunes played by a small step sequencer, as in
// Stickman Arena. Notes are MIDI numbers, one per eighth note; 0 is a rest.
//
// Caleb's answer: each mode gets its own game track, plus the menu theme.
// A game track can have a tension layer that fades in while a king is in check
// or a clock is low (setTension).

export type TrackId = 'menu' | 'standard';

interface Track {
  bpm: number;
  lead: number[];
  leadType: OscillatorType;
  bass: number[];
  /** Short chord stabs: one chord (or null) per eighth note. */
  chords: (number[] | null)[];
  /** Drum pattern: k = kick, s = snare, h = hat, . = rest. One character per eighth note. */
  drums: string;
  /** Played only while the tension layer is up. */
  tension?: { drums: string; arp: number[]; arpType: OscillatorType };
}

const bar = (...n: number[]) => n;
const rep = <T,>(a: T[], times: number) => Array.from({ length: times }, () => a).flat();

// "Opening" (menus): light and playful, F major (F, Dm, Bb, C), a plucked square lead.
const menu: Track = {
  bpm: 112,
  leadType: 'square',
  lead: [
    ...bar(77, 0, 72, 69, 72, 77, 81, 0),
    ...bar(79, 77, 74, 0, 69, 74, 77, 0),
    ...bar(74, 0, 70, 74, 77, 0, 82, 81),
    ...bar(79, 0, 76, 72, 74, 76, 79, 0),
    ...bar(81, 0, 77, 72, 77, 0, 84, 81),
    ...bar(79, 0, 77, 74, 81, 79, 77, 74),
    ...bar(77, 0, 74, 70, 74, 77, 82, 0),
    ...bar(79, 76, 72, 76, 77, 0, 0, 0),
  ],
  bass: [41, 38, 34, 36, 41, 38, 34, 36].flatMap((r) => bar(r, 0, r + 12, 0, r + 7, 0, r + 12, 0)),
  chords: rep([null, null, null, null, null, null, null, null], 8),
  drums: rep(['k.h.s.hh'], 8).join(''),
};

// "Gambit" (Standard Chess): thoughtful but driving, A minor (Am, F, C, G, Am, F, E, E),
// a soft triangle lead over a pulsing bass. Tension: four-on-the-floor kicks,
// running hats and a sawtooth arpeggio.
const am = [57, 60, 64];
const f = [57, 60, 65];
const c = [55, 60, 64];
const g = [55, 59, 62];
const e = [56, 59, 64];
const standard: Track = {
  bpm: 100,
  leadType: 'triangle',
  lead: [
    ...bar(76, 0, 0, 72, 74, 0, 76, 0),
    ...bar(77, 0, 76, 74, 72, 0, 69, 0),
    ...bar(72, 0, 0, 67, 72, 0, 74, 76),
    ...bar(74, 0, 0, 0, 71, 0, 67, 0),
    ...bar(81, 0, 79, 0, 76, 0, 72, 0),
    ...bar(77, 0, 76, 0, 74, 72, 69, 0),
    ...bar(68, 0, 71, 0, 74, 0, 76, 0),
    ...bar(76, 0, 74, 0, 71, 0, 68, 0),
  ],
  bass: [45, 41, 36, 43, 45, 41, 40, 40].flatMap((r) => bar(r, r, r + 12, r, r, r, r + 12, r)),
  chords: [am, f, c, g, am, f, e, e].flatMap((ch) => [ch, null, null, null, ch, null, null, null]),
  drums: rep(['k..hs..h'], 8).join(''),
  tension: {
    drums: rep(['khkhkhkh'], 8).join(''),
    arp: [am, f, c, g, am, f, e, e].flatMap((ch) => [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12, ch[2] + 12]),
    arpType: 'sawtooth',
  },
};

const TRACKS: Record<TrackId, Track> = { menu, standard };

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD = 0.2;

let current: { id: TrackId; out: GainNode; tension: GainNode; step: number; next: number; timer: number } | null = null;
let wanted: TrackId | null = null;
let tensionOn = false;

/** Plays a track (keeps playing if it is already on). null stops the music. */
export function playMusic(id: TrackId | null) {
  wanted = id;
  if (current?.id === id) return;
  stop();
  if (id) whenAudioStarts(() => wanted === id && !current && start(id));
}

/** Fades the current track's tension layer in or out. */
export function setTension(on: boolean) {
  if (tensionOn === on) return;
  tensionOn = on;
  const a = getAudio();
  if (a && current) current.tension.gain.setTargetAtTime(on ? 1 : 0, a.ctx.currentTime, on ? 0.25 : 0.6);
}

function stop() {
  if (!current) return;
  const a = getAudio();
  const c = current;
  current = null;
  window.clearInterval(c.timer);
  if (a) {
    c.out.gain.setTargetAtTime(0, a.ctx.currentTime, 0.12);
    window.setTimeout(() => c.out.disconnect(), 800);
  } else c.out.disconnect();
}

function start(id: TrackId) {
  const a = getAudio();
  if (!a) return;
  const out = a.ctx.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(1, a.ctx.currentTime, 0.2);
  out.connect(a.music);
  const tension = a.ctx.createGain();
  tension.gain.value = tensionOn ? 1 : 0;
  tension.connect(out);
  current = { id, out, tension, step: 0, next: a.ctx.currentTime + 0.1, timer: 0 };
  const c = current;
  c.timer = window.setInterval(() => schedule(c), 50);
  schedule(c);
}

function schedule(c: NonNullable<typeof current>) {
  const a = getAudio();
  if (!a || current !== c) return;
  const t = TRACKS[c.id];
  const eighth = 60 / t.bpm / 2;
  // After a long pause (app in the background), pick up from now instead of catching up.
  if (c.next < a.ctx.currentTime - 0.25) c.next = a.ctx.currentTime + 0.05;
  while (c.next < a.ctx.currentTime + LOOKAHEAD) {
    const i = c.step % t.lead.length;
    const at = c.next;
    const len = eighth * 0.9;
    if (t.lead[i]) voice(a.ctx, c.out, t.leadType, midiHz(t.lead[i]), at, len, t.leadType === 'triangle' ? 0.12 : 0.06, 3200);
    const b = t.bass[i % t.bass.length];
    if (b) voice(a.ctx, c.out, 'triangle', midiHz(b), at, len * 0.95, 0.2, 900);
    const chord = t.chords[i % t.chords.length];
    if (chord) chord.forEach((m) => voice(a.ctx, c.out, 'square', midiHz(m), at, eighth * 0.6, 0.018, 1600));
    drum(a, c.out, t.drums[i % t.drums.length], at);
    if (t.tension) {
      drum(a, c.tension, t.tension.drums[i % t.tension.drums.length], at);
      // Sixteenth-note hats between the eighths.
      drum(a, c.tension, 'h', at + eighth / 2);
      const n = t.tension.arp[i % t.tension.arp.length];
      if (n) voice(a.ctx, c.tension, t.tension.arpType, midiHz(n), at, eighth * 0.5, 0.035, 2400);
    }
    c.step++;
    c.next += eighth;
  }
}

function voice(ctx: AudioContext, out: AudioNode, type: OscillatorType, hz: number, at: number, len: number, gain: number, cutoff: number) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = hz;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.008);
  g.gain.setTargetAtTime(gain * 0.6, at + 0.02, 0.08);
  g.gain.setTargetAtTime(0, at + len, 0.02);
  osc.connect(filter).connect(g).connect(out);
  osc.start(at);
  osc.stop(at + len + 0.15);
}

function drum(a: NonNullable<ReturnType<typeof getAudio>>, out: AudioNode, kind: string, at: number) {
  const { ctx } = a;
  if (kind === 'k') {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, at);
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    g.gain.setValueAtTime(0.32, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + 0.2);
    return;
  }
  if (kind !== 's' && kind !== 'h') return;
  const src = ctx.createBufferSource();
  src.buffer = a.noise;
  const filter = ctx.createBiquadFilter();
  filter.type = kind === 's' ? 'bandpass' : 'highpass';
  filter.frequency.value = kind === 's' ? 1800 : 7000;
  const g = ctx.createGain();
  const dur = kind === 's' ? 0.12 : 0.03;
  g.gain.setValueAtTime(kind === 's' ? 0.14 : 0.04, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter).connect(g).connect(out);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}
