// Time controls (spec section 3, "Clocks": presets and increment are Claude
// Code's). The host picks one in the room; any mode can be timed or untimed.

/** Minutes for each player, plus seconds added after each of their moves. null = untimed. */
export type TimeControl = { minutes: number; increment: number } | null;

export const PRESETS: { minutes: number; increment: number }[] = [
  { minutes: 1, increment: 0 },
  { minutes: 3, increment: 0 },
  { minutes: 3, increment: 2 },
  { minutes: 5, increment: 0 },
  { minutes: 5, increment: 3 },
  { minutes: 10, increment: 0 },
  { minutes: 10, increment: 5 },
  { minutes: 15, increment: 10 },
  { minutes: 30, increment: 0 },
  { minutes: 30, increment: 20 },
];

export const CUSTOM_LIMITS = { minutes: [1, 180], increment: [0, 60] } as const;

export const timeLabel = (t: TimeControl) => (t ? `${t.minutes} + ${t.increment}` : 'Untimed');

export function sameTime(a: TimeControl, b: TimeControl) {
  return a === b || (!!a && !!b && a.minutes === b.minutes && a.increment === b.increment);
}

/** 0:00 style, with tenths in the last ten seconds. */
export function formatClock(ms: number) {
  const t = Math.max(0, ms);
  if (t < 10_000) return `0:0${Math.floor(t / 1000)}.${Math.floor((t % 1000) / 100)}`;
  const s = Math.ceil(t / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
