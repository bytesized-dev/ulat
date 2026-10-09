import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_LOCK_MS, LAST_INPUT_KEY, STORE_EVERY_MS, watchIdle } from "./idle";

const minutes = (n: number) => n * 60_000;

// A shared store, as localStorage is shared by the tabs of one browser.
const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => void map.set(key, value)),
  };
};

describe("watchIdle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("locks after 10 minutes with no input", () => {
    const onIdle = vi.fn();
    watchIdle(onIdle, { target: new EventTarget(), storage: null });
    vi.advanceTimersByTime(IDLE_LOCK_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("uses 10 minutes as the default", () => {
    expect(IDLE_LOCK_MS).toBe(minutes(10));
  });

  it("starts the count again on input", () => {
    const target = new EventTarget();
    const onIdle = vi.fn();
    watchIdle(onIdle, { target, storage: null });
    vi.advanceTimersByTime(minutes(9));
    target.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(minutes(9));
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(minutes(1));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it.each(["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"])("counts %s as input", (type) => {
    const target = new EventTarget();
    const onIdle = vi.fn();
    watchIdle(onIdle, { target, storage: null });
    vi.advanceTimersByTime(minutes(9));
    target.dispatchEvent(new Event(type));
    vi.advanceTimersByTime(minutes(9));
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("ignores other events", () => {
    const target = new EventTarget();
    const onIdle = vi.fn();
    watchIdle(onIdle, { target, storage: null });
    vi.advanceTimersByTime(minutes(9));
    target.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(minutes(1));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("locks once, then stops listening", () => {
    const target = new EventTarget();
    const onIdle = vi.fn();
    watchIdle(onIdle, { target, storage: null });
    vi.advanceTimersByTime(minutes(30));
    target.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(minutes(30));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("does nothing after stop", () => {
    const onIdle = vi.fn();
    const stop = watchIdle(onIdle, { target: new EventTarget(), storage: null });
    vi.advanceTimersByTime(minutes(5));
    stop();
    vi.advanceTimersByTime(minutes(30));
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("locks at once when a timer fires late, as after sleep", () => {
    const onIdle = vi.fn();
    watchIdle(onIdle, { target: new EventTarget(), storage: null });
    // The clock jumps, as it does when the laptop sleeps, and the timer has not run yet.
    vi.setSystemTime(Date.now() + minutes(60));
    vi.advanceTimersByTime(IDLE_LOCK_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("takes a different timeout", () => {
    const onIdle = vi.fn();
    watchIdle(onIdle, { timeoutMs: 1000, target: new EventTarget(), storage: null });
    vi.advanceTimersByTime(1000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  describe("with several tabs", () => {
    it("does not lock while another tab has input", () => {
      const storage = memoryStorage();
      const idleTab = new EventTarget();
      const busyTab = new EventTarget();
      const onIdle = vi.fn();
      watchIdle(onIdle, { target: idleTab, storage });
      watchIdle(vi.fn(), { target: busyTab, storage });
      vi.advanceTimersByTime(minutes(9));
      busyTab.dispatchEvent(new Event("keydown"));
      vi.advanceTimersByTime(minutes(1));
      expect(onIdle).not.toHaveBeenCalled();
      // The idle tab checks again when the busy tab's 10 minutes run out.
      vi.advanceTimersByTime(minutes(9) - 1);
      expect(onIdle).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onIdle).toHaveBeenCalledTimes(1);
    });

    it("does not lock on a stored time that is recent", () => {
      const storage = memoryStorage();
      const onIdle = vi.fn();
      watchIdle(onIdle, { target: new EventTarget(), storage });
      vi.advanceTimersByTime(minutes(8));
      storage.setItem(LAST_INPUT_KEY, String(Date.now()));
      vi.advanceTimersByTime(minutes(2));
      expect(onIdle).not.toHaveBeenCalled();
      vi.advanceTimersByTime(minutes(8));
      expect(onIdle).toHaveBeenCalledTimes(1);
    });

    it("ignores a stored time that is old, broken or in the future", () => {
      for (const value of [String(Date.now() - minutes(60)), "soon", String(Date.now() + minutes(60))]) {
        const storage = memoryStorage();
        const onIdle = vi.fn();
        watchIdle(onIdle, { target: new EventTarget(), storage });
        storage.setItem(LAST_INPUT_KEY, value);
        vi.advanceTimersByTime(IDLE_LOCK_MS);
        expect(onIdle).toHaveBeenCalledTimes(1);
      }
    });

    it("writes input to storage at most once every few seconds", () => {
      const storage = memoryStorage();
      const target = new EventTarget();
      watchIdle(vi.fn(), { target, storage });
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 50; i++) target.dispatchEvent(new Event("pointermove"));
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(STORE_EVERY_MS);
      target.dispatchEvent(new Event("pointermove"));
      expect(storage.setItem).toHaveBeenCalledTimes(2);
    });

    it("still locks on its own when storage is blocked", () => {
      const broken = {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      };
      const onIdle = vi.fn();
      watchIdle(onIdle, { target: new EventTarget(), storage: broken });
      vi.advanceTimersByTime(IDLE_LOCK_MS);
      expect(onIdle).toHaveBeenCalledTimes(1);
    });
  });
});
