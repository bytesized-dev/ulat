import { useSyncExternalStore } from "react";

// True when the person asked their device for less motion. CSS covers
// transitions and keyframes. This is for motion drawn from script, such as a
// waveform that follows the microphone.

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
