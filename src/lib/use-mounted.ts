import { useSyncExternalStore } from "react";

// True after hydration, false during the server render and the first client
// render, so both agree. Use this instead of a mounted flag set in an effect.

const subscribe = () => () => {};

export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
