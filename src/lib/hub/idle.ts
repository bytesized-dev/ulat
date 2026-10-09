/** The hub locks after this long with no input. See docs/SPEC.md section 1. */
export const IDLE_LOCK_MS = 10 * 60_000;

/** Input that counts as someone being at the laptop. */
export const activityEvents = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;

type IdleTarget = {
  addEventListener(type: string, listener: () => void, options?: AddEventListenerOptions): void;
  removeEventListener(type: string, listener: () => void, options?: EventListenerOptions): void;
};

type WatchIdleOptions = {
  timeoutMs?: number;
  /** Where input is heard. The window in the browser. */
  target?: IdleTarget;
};

/**
 * Calls onIdle once, after timeoutMs with no input on the target. Input only
 * records the time, and the timer checks it when it fires, so a stream of
 * mouse moves costs nothing. A timer that fires late, such as after the laptop
 * slept, still sees the old time and locks at once. Returns a function that stops watching.
 */
export function watchIdle(onIdle: () => void, { timeoutMs = IDLE_LOCK_MS, target = window }: WatchIdleOptions = {}): () => void {
  // Capture, so scrolling inside a panel counts although scroll does not bubble.
  const options = { capture: true, passive: true };
  let lastInput = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const touch = () => {
    lastInput = Date.now();
  };
  const check = () => {
    const left = lastInput + timeoutMs - Date.now();
    if (left > 0) {
      timer = setTimeout(check, left);
      return;
    }
    stop();
    onIdle();
  };
  const stop = () => {
    clearTimeout(timer);
    for (const type of activityEvents) target.removeEventListener(type, touch, options);
  };

  for (const type of activityEvents) target.addEventListener(type, touch, options);
  timer = setTimeout(check, timeoutMs);
  return stop;
}
