import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_LOCK_MS, watchIdle } from "./idle";

const minutes = (n: number) => n * 60_000;

describe("watchIdle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("locks after 10 minutes with no input", () => {
    const onIdle = vi.fn();
    watchIdle(onIdle, { target: new EventTarget() });
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
    watchIdle(onIdle, { target });
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
    watchIdle(onIdle, { target });
    vi.advanceTimersByTime(minutes(9));
    target.dispatchEvent(new Event(type));
    vi.advanceTimersByTime(minutes(9));
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("ignores other events", () => {
    const target = new EventTarget();
    const onIdle = vi.fn();
    watchIdle(onIdle, { target });
    vi.advanceTimersByTime(minutes(9));
    target.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(minutes(1));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("locks once, then stops listening", () => {
    const target = new EventTarget();
    const onIdle = vi.fn();
    watchIdle(onIdle, { target });
    vi.advanceTimersByTime(minutes(30));
    target.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(minutes(30));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("does nothing after stop", () => {
    const onIdle = vi.fn();
    const stop = watchIdle(onIdle, { target: new EventTarget() });
    vi.advanceTimersByTime(minutes(5));
    stop();
    vi.advanceTimersByTime(minutes(30));
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("locks at once when a timer fires late, as after sleep", () => {
    const onIdle = vi.fn();
    watchIdle(onIdle, { target: new EventTarget() });
    // The clock jumps, as it does when the laptop sleeps, and the timer has not run yet.
    vi.setSystemTime(Date.now() + minutes(60));
    vi.advanceTimersByTime(IDLE_LOCK_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("takes a different timeout", () => {
    const onIdle = vi.fn();
    watchIdle(onIdle, { timeoutMs: 1000, target: new EventTarget() });
    vi.advanceTimersByTime(1000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});
