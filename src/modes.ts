// The game modes in the spec (section 7), in the spec's order. Modes not built
// yet show the stage they arrive in.

import type { TrackId } from './lib/audio/music';

export type ModeId = 'standard' | 'bastille' | 'pothole' | 'bario' | 'revival' | 'rental' | 'megaknight' | 'remorse';

export interface ModeInfo {
  id: ModeId;
  name: string;
  /** As the spec's heading gives it. */
  author: string | null;
  /** One line for the mode list. */
  blurb: string;
  /** The build stage it arrives in, or null when it is playable. */
  stage: number | null;
}

export const MODES: ModeInfo[] = [
  { id: 'standard', name: 'Standard Chess', author: null, blurb: 'Orthodox chess.', stage: null },
  { id: 'bastille', name: 'Bastille Chess', author: 'Paul DeWitte', blurb: 'Empty your opponent’s palace to win. Kings are not royal.', stage: null },
  { id: 'pothole', name: 'Pot-Hole Chess', author: 'Peter Spicer and Michael Chamberlain', blurb: 'After every move, a die roll can open a pothole.', stage: null },
  { id: 'bario', name: 'Bario', author: 'Panos Louridas', blurb: 'Undefined Quantum pieces choose what they are when they move.', stage: null },
  { id: 'revival', name: 'Revival Chess', author: 'Bardelo Bardalini', blurb: 'Captured pieces go to an auxiliary board and can fight their way back.', stage: 6 },
  { id: 'rental', name: 'Rental Chess', author: 'inspired by Ralph Betza', blurb: 'Your units earn income and pay rent for the squares they stand on.', stage: null },
  { id: 'megaknight', name: 'Mega Knight Chess', author: 'Bardelo Bardalini', blurb: 'A neutral 2x2 knight that either player can move on a roll of 6.', stage: null },
  { id: 'remorse', name: 'Remorse Chess: Psychos and Devastation', author: 'Bardelo Bardalini', blurb: 'A capture can give the capturing piece a status effect.', stage: null },
];

export const modeInfo = (id: ModeId) => MODES.find((m) => m.id === id)!;

/** Each mode's own game music (Caleb's answer: unique music per mode). Added as each mode is built. */
export const MODE_TRACK: Partial<Record<ModeId, TrackId>> = { standard: 'standard', bastille: 'bastille', pothole: 'pothole', megaknight: 'megaknight', remorse: 'remorse', bario: 'bario', rental: 'rental' };
