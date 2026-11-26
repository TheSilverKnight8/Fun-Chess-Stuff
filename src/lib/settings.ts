import { createStore, useStore } from './store';

// Settings (spec section 4). The spec says nothing is saved between sessions,
// so these last until the app is closed and start from the defaults next time.

export interface Settings {
  /** 0.5 (dim) to 1 (full). Darkens the whole screen. */
  brightness: number;
  /** 0 to 1. */
  musicVolume: number;
  /** 0 to 1. */
  effectsVolume: number;
  /** Show where the picked piece can go (spec: on by default). */
  legalMoves: boolean;
  /** Mark the last move's two squares (Caleb: on by default). */
  lastMove: boolean;
  /** Stage 7 (Caleb): mark the squares each side attacks (a button during play; off by default). */
  attacks: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  brightness: 1,
  musicVolume: 0.5,
  effectsVolume: 0.8,
  legalMoves: true,
  lastMove: true,
  attacks: false,
};

export const settings = createStore<Settings>({ ...DEFAULT_SETTINGS });

export function useSettings() {
  return useStore(settings);
}

export function updateSettings(patch: Partial<Settings>) {
  settings.set((s) => ({ ...s, ...patch }));
}
