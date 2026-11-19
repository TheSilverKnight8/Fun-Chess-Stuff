import { useEffect } from 'react';
import { playMusic, type TrackId } from './music';

/** Plays a music track while this screen is showing. */
export function useMusic(track: TrackId | null) {
  useEffect(() => {
    playMusic(track);
  }, [track]);
}
