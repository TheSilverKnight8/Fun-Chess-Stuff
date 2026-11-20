import { getAudio, whenAudioStarts } from './engine';

// Background music: short looping tunes played by a small step sequencer, as in
// Stickman Arena. Notes are MIDI numbers, one per eighth note; 0 is a rest.
//
// Caleb's answer: each mode gets its own game track, plus the menu theme.
// A game track can have a tension layer that fades in while a king is in check
// or a clock is low (setTension).

export type TrackId = 'menu' | 'standard' | 'bastille' | 'pothole' | 'megaknight' | 'remorse';

interface Track {
  bpm: number;
  /** 0 = straight eighths, up to ~0.33 for a swing feel. */
  swing?: number;
  lead: number[];
  leadType: OscillatorType;
  /** Piano-like voices that ring on (the score's sustain pedal) instead of short notes. */
  piano?: boolean;
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

// Menu theme: a rendition of Caleb's piano piece ("Untitled score", given as a
// MIDI file in Stage 3). Each step is one of its quarter notes at 240 beats a
// minute. Sixteen seventh chords in C major, each arpeggiated up and down twice
// (1-3-5-7-5-3) over a held bass note an octave below its root, three bars per
// chord; played on a sustained, piano-like voice as with the score's pedal.
const MENU_CHORDS = [
  [60, 64, 67, 71], [62, 65, 69, 72], [60, 64, 67, 71], [59, 62, 65, 69],
  [57, 60, 64, 67], [55, 59, 62, 65], [53, 57, 60, 64], [52, 55, 59, 62],
  [50, 53, 57, 60], [48, 52, 55, 59], [50, 53, 57, 60], [52, 55, 59, 62],
  [53, 57, 60, 64], [55, 59, 62, 65], [57, 60, 64, 67], [59, 62, 65, 69],
];
const menu: Track = {
  bpm: 120,
  leadType: 'triangle',
  piano: true,
  lead: MENU_CHORDS.flatMap((c) => rep([c[0], c[1], c[2], c[3], c[2], c[1]], 2)),
  bass: MENU_CHORDS.flatMap((c) => [c[0] - 12, ...rep([0], 11)]),
  chords: [null],
  drums: '.',
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

// "Storming" (Bastille Chess): a revolutionary march in G minor (Gm, Gm, Eb, D,
// Gm, Cm, D, Gm), square-wave fife lead, snare-heavy drums. Tension: a snare
// roll and a sawtooth arpeggio.
const gm = [55, 58, 62];
const eb = [55, 58, 63];
const dM = [54, 57, 62];
const cm = [55, 60, 63];
const bastille: Track = {
  bpm: 120,
  leadType: 'square',
  lead: [
    ...bar(67, 0, 67, 67, 70, 0, 67, 0),
    ...bar(74, 0, 72, 70, 69, 0, 67, 0),
    ...bar(70, 0, 70, 70, 72, 0, 74, 0),
    ...bar(69, 0, 66, 69, 74, 0, 0, 0),
    ...bar(79, 0, 79, 79, 77, 0, 74, 0),
    ...bar(75, 0, 74, 72, 70, 0, 72, 0),
    ...bar(74, 0, 72, 70, 69, 66, 62, 0),
    ...bar(67, 0, 62, 0, 67, 0, 0, 0),
  ],
  bass: [43, 43, 39, 38, 43, 36, 38, 43].flatMap((r) => bar(r, 0, r + 7, 0, r, 0, r + 7, 0)),
  chords: [gm, gm, eb, dM, gm, cm, dM, gm].flatMap((ch) => [ch, null, null, null, ch, null, null, null]),
  drums: rep(['k.s.k.ss'], 8).join(''),
  tension: {
    drums: rep(['ssssksss'], 8).join(''),
    arp: [gm, gm, eb, dM, gm, cm, dM, gm].flatMap((ch) => [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12, ch[0] + 12, ch[1] + 12]),
    arpType: 'sawtooth',
  },
};

// "Bumpy Road" (Pot-Hole Chess): a lurching, swung tune in D (D, D, C, G, D, D,
// A, D) with a bouncing octave bass and a lead that keeps jumping. Tension:
// doubled kicks and a square-wave arpeggio.
const dMaj = [62, 66, 69];
const cMaj = [60, 64, 67];
const gMaj = [59, 62, 67];
const aMaj = [61, 64, 69];
const pothole: Track = {
  bpm: 104,
  swing: 0.3,
  leadType: 'triangle',
  lead: [
    ...bar(74, 0, 69, 0, 66, 69, 74, 0),
    ...bar(78, 0, 76, 74, 0, 69, 0, 0),
    ...bar(76, 0, 72, 0, 67, 72, 76, 0),
    ...bar(74, 0, 71, 0, 67, 0, 0, 0),
    ...bar(74, 0, 78, 0, 81, 0, 78, 74),
    ...bar(76, 0, 74, 0, 72, 71, 69, 0),
    ...bar(73, 0, 76, 0, 81, 0, 79, 76),
    ...bar(74, 0, 0, 0, 62, 0, 0, 0),
  ],
  bass: [38, 38, 36, 43, 38, 38, 45, 38].flatMap((r) => bar(r, r + 12, 0, r, r + 12, 0, r + 7, 0)),
  chords: [dMaj, dMaj, cMaj, gMaj, dMaj, dMaj, aMaj, dMaj].flatMap((ch) => [null, ch, null, null, null, ch, null, null]),
  drums: rep(['k.hskkhs'], 8).join(''),
  tension: {
    drums: rep(['kkhskkhs'], 8).join(''),
    arp: [dMaj, dMaj, cMaj, gMaj, dMaj, dMaj, aMaj, dMaj].flatMap((ch) => [ch[0] + 12, ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12, ch[0] + 12]),
    arpType: 'square',
  },
};

// "Colossus" (Mega Knight Chess): heavy and stomping, C minor (Cm, Ab, Eb, Bb, Cm, Ab, G, G),
// a sawtooth lead over half-time drums that land like footsteps. Tension: a pounding kick and arpeggio.
const cmin = [55, 60, 63];
const abM = [56, 60, 63];
const ebM = [55, 58, 63];
const bbM = [53, 58, 62];
const gM = [55, 59, 62];
const megaknight: Track = {
  bpm: 92,
  leadType: 'sawtooth',
  lead: [
    ...bar(72, 0, 0, 75, 74, 0, 72, 0),
    ...bar(68, 0, 0, 72, 75, 0, 0, 0),
    ...bar(70, 0, 67, 70, 75, 0, 74, 0),
    ...bar(74, 0, 0, 70, 65, 0, 0, 0),
    ...bar(79, 0, 0, 77, 75, 0, 72, 0),
    ...bar(80, 0, 79, 0, 77, 75, 72, 0),
    ...bar(71, 0, 74, 0, 79, 0, 77, 0),
    ...bar(74, 0, 71, 0, 67, 0, 0, 0),
  ],
  bass: [36, 32, 39, 34, 36, 32, 31, 31].flatMap((r) => bar(r, 0, 0, r, r + 12, 0, r, 0)),
  chords: [cmin, abM, ebM, bbM, cmin, abM, gM, gM].flatMap((ch) => [ch, null, null, null, null, null, null, null]),
  drums: rep(['k...s..k'], 8).join(''),
  tension: {
    drums: rep(['k.k.s.kk'], 8).join(''),
    arp: [cmin, abM, ebM, bbM, cmin, abM, gM, gM].flatMap((ch) => [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12, ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12]),
    arpType: 'sawtooth',
  },
};

// "Remorse" (Remorse Chess): uneasy and creeping, E minor (Em, C, Am, B7, Em, C, F#dim, B7),
// a thin square lead that sighs downward, sparse drums. Tension: a frantic square arpeggio and running hats.
const em = [55, 59, 64];
const cM = [55, 60, 64];
const amn = [57, 60, 64];
const b7 = [54, 59, 63];
const fdim = [54, 57, 60];
const remorse: Track = {
  bpm: 84,
  leadType: 'square',
  lead: [
    ...bar(76, 0, 75, 76, 71, 0, 0, 0),
    ...bar(72, 0, 71, 72, 67, 0, 0, 0),
    ...bar(69, 0, 72, 0, 76, 0, 74, 72),
    ...bar(71, 0, 0, 0, 75, 0, 0, 0),
    ...bar(79, 0, 78, 79, 76, 0, 0, 0),
    ...bar(76, 0, 74, 72, 71, 0, 72, 0),
    ...bar(69, 0, 66, 0, 72, 0, 69, 0),
    ...bar(71, 0, 0, 0, 63, 0, 66, 0),
  ],
  bass: [40, 36, 45, 35, 40, 36, 42, 35].flatMap((r) => bar(r, 0, 0, 0, r + 7, 0, 0, 0)),
  chords: [em, cM, amn, b7, em, cM, fdim, b7].flatMap((ch) => [null, null, ch, null, null, null, ch, null]),
  drums: rep(['k..h..s.'], 8).join(''),
  tension: {
    drums: rep(['hhhhshhh'], 8).join(''),
    arp: [em, cM, amn, b7, em, cM, fdim, b7].flatMap((ch) => [ch[2] + 12, ch[1] + 12, ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12, ch[0] + 12, ch[1] + 12]),
    arpType: 'square',
  },
};

const TRACKS: Record<TrackId, Track> = { menu, standard, bastille, pothole, megaknight, remorse };

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
    const at = c.next + (c.step % 2 === 1 ? (t.swing ?? 0) * eighth : 0);
    const len = eighth * 0.9;
    const b = t.bass[i % t.bass.length];
    if (t.piano) {
      if (t.lead[i]) piano(a.ctx, c.out, midiHz(t.lead[i]), at, 2.2, 0.09);
      if (b) piano(a.ctx, c.out, midiHz(b), at, eighth * 12, 0.16);
    } else {
      if (t.lead[i]) voice(a.ctx, c.out, t.leadType, midiHz(t.lead[i]), at, len, t.leadType === 'triangle' ? 0.12 : 0.06, 3200);
      if (b) voice(a.ctx, c.out, 'triangle', midiHz(b), at, len * 0.95, 0.2, 900);
    }
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

/** A struck, ringing note: a quick attack, then a long fade with the tone mellowing, like a pedalled piano. */
function piano(ctx: AudioContext, out: AudioNode, hz: number, at: number, ring: number, gain: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.006);
  g.gain.setTargetAtTime(gain * 0.35, at + 0.01, 0.25);
  g.gain.setTargetAtTime(0, at + 0.3, ring / 3);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(9000, hz * 8), at);
  filter.frequency.setTargetAtTime(Math.min(4000, hz * 3), at + 0.02, 0.4);
  filter.connect(g).connect(out);
  // A triangle body with a little sine an octave up for the hammer's brightness.
  ([['triangle', 1, 1], ['sine', 2, 0.25]] as const).forEach(([type, mult, level]) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz * mult;
    const og = ctx.createGain();
    og.gain.value = level;
    osc.connect(og).connect(filter);
    osc.start(at);
    osc.stop(at + ring + 0.5);
  });
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
