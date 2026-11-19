import { createStore, useStore } from './store';

// Settings (spec section 4). The spec says nothing is saved between sessions,
// so these last until the app is closed and start from the defaults next time.
// Music and effects volume arrive with the sound in Stage 2.

export interface Settings {
  /** 0.5 (dim) to 1 (full). Darkens the whole screen. */
  brightness: number;
  /** Show where the picked piece can go (spec: on by default). */
  legalMoves: boolean;
  /** Mark the last move's two squares (Caleb: on by default). */
  lastMove: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  brightness: 1,
  legalMoves: true,
  lastMove: true,
};

export const settings = createStore<Settings>({ ...DEFAULT_SETTINGS });

export function useSettings() {
  return useStore(settings);
}

export function updateSettings(patch: Partial<Settings>) {
  settings.set((s) => ({ ...s, ...patch }));
}
