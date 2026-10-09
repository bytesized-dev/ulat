/** The hub locks after this long with no input. See docs/SPEC.md section 1. */
export const IDLE_LOCK_MS = 10 * 60_000;

/** Input that counts as someone being at the laptop. */
export const activityEvents = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;

/** Where tabs share the time of their last input. Locking signs out every tab, so every tab has to agree. */
export const LAST_INPUT_KEY = "ulat:hub:last-input";

/** Input is written to storage at most this often. */
export const STORE_EVERY_MS = 5_000;

type IdleTarget = {
  addEventListener(type: string, listener: () => void, options?: AddEventListenerOptions): void;
  removeEventListener(type: string, listener: () => void, options?: EventListenerOptions): void;
};

type IdleStorage = Pick<Storage, "getItem" | "setItem">;

type WatchIdleOptions = {
  timeoutMs?: number;
  /** Where input is heard. The window in the browser. */
  target?: IdleTarget;
  /** Where tabs share their last input. localStorage in the browser, none when it is blocked. */
  storage?: IdleStorage | null;
};

function browserStorage(): IdleStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Calls onIdle once, after timeoutMs with no input in this tab or any other tab
 * of the hub. Input records the time and, at most every few seconds, writes it
 * to storage. The timer checks the later of the two when it fires, so a stream
 * of mouse moves costs nothing, a tab nobody touches does not sign out the tab
 * staff are using, and a timer that fires late, such as after the laptop
 * slept, still sees the old time and locks at once. Returns a function that stops watching.
 */
export function watchIdle(
  onIdle: () => void,
  { timeoutMs = IDLE_LOCK_MS, target = window, storage = browserStorage() }: WatchIdleOptions = {},
): () => void {
  // Capture, so scrolling inside a panel counts although scroll does not bubble.
  const options = { capture: true, passive: true };
  let lastInput = Date.now();
  let lastWrite = -Infinity;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const store = () => {
    lastWrite = Date.now();
    try {
      storage?.setItem(LAST_INPUT_KEY, String(lastInput));
    } catch {
      // Storage full or blocked. This tab still locks on its own input.
    }
  };
  // Another tab's time. A missing, broken or future value counts for nothing.
  const stored = () => {
    try {
      const value = Number(storage?.getItem(LAST_INPUT_KEY));
      return Number.isFinite(value) && value <= Date.now() ? value : 0;
    } catch {
      return 0;
    }
  };
  const touch = () => {
    lastInput = Date.now();
    if (lastInput - lastWrite >= STORE_EVERY_MS) store();
  };
  const check = () => {
    const left = Math.max(lastInput, stored()) + timeoutMs - Date.now();
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
  store();
  timer = setTimeout(check, timeoutMs);
  return stop;
}
