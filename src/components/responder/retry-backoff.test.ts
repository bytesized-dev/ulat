import { describe, expect, it } from "vitest";
import { BACKOFF_CAP_MS, backoffDelay, createBackoff, mayFlush, parseRetryAfter, RETRY_AFTER_CAP_MS } from "./retry-backoff";

describe("backoffDelay", () => {
  it("doubles from 5 s and stops at the cap, with the fixed half and the random half", () => {
    const ceilings = [5000, 10_000, 20_000, 40_000, 80_000, 120_000, 120_000, 120_000];
    ceilings.forEach((ceiling, i) => {
      expect(backoffDelay(i + 1, () => 0)).toBe(ceiling / 2);
      expect(backoffDelay(i + 1, () => 1)).toBe(ceiling);
    });
    expect(BACKOFF_CAP_MS).toBe(120_000);
  });

  it("never goes past the cap, however many failures", () => {
    expect(backoffDelay(60, () => 1)).toBe(BACKOFF_CAP_MS);
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds and dates", () => {
    expect(parseRetryAfter("30")).toBe(30_000);
    expect(parseRetryAfter(" 0 ")).toBe(0);
    const now = Date.parse("2026-10-10T10:00:00Z");
    expect(parseRetryAfter("Sat, 10 Oct 2026 10:01:00 GMT", now)).toBe(60_000);
    expect(parseRetryAfter("Sat, 10 Oct 2026 09:00:00 GMT", now)).toBe(0);
  });

  it("gives null for nothing or nonsense, and caps a very long wait", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter("86400")).toBe(RETRY_AFTER_CAP_MS);
  });
});

describe("createBackoff", () => {
  it("waits out each failure, longer every time, and resets", () => {
    let t = 1000;
    const backoff = createBackoff(() => t, () => 1);
    expect(backoff.ready()).toBe(true);
    backoff.failed();
    expect(backoff.ready()).toBe(false);
    t += 4999;
    expect(backoff.ready()).toBe(false);
    t += 1;
    expect(backoff.ready()).toBe(true);
    backoff.failed();
    t += 9999;
    expect(backoff.ready()).toBe(false);
    t += 1;
    expect(backoff.ready()).toBe(true);
    expect(backoff.attempts).toBe(2);
    backoff.failed();
    backoff.reset();
    expect(backoff.attempts).toBe(0);
    expect(backoff.ready()).toBe(true);
  });

  it("lets Retry-After lengthen the wait but never shorten it", () => {
    let t = 0;
    const backoff = createBackoff(() => t, () => 1);
    backoff.failed(60_000);
    t = 59_999;
    expect(backoff.ready()).toBe(false);
    t = 60_000;
    expect(backoff.ready()).toBe(true);
    backoff.failed(1000);
    t += 9999;
    expect(backoff.ready()).toBe(false);
  });
});

describe("mayFlush", () => {
  const base = { inRange: true, waiting: true, signedOut: false, backoffReady: true, manual: false };

  it("posts when the hub answers, an entry waits and no wait is on", () => {
    expect(mayFlush(base)).toBe(true);
  });

  it("does not post out of range or with nothing waiting", () => {
    expect(mayFlush({ ...base, inRange: false })).toBe(false);
    expect(mayFlush({ ...base, waiting: false })).toBe(false);
    expect(mayFlush({ ...base, inRange: false, manual: true })).toBe(false);
  });

  it("does not post during the backoff wait", () => {
    expect(mayFlush({ ...base, backoffReady: false })).toBe(false);
  });

  it("does not post after a 401, even when the backoff is ready", () => {
    expect(mayFlush({ ...base, signedOut: true })).toBe(false);
  });

  it("lets a tap on Try again skip the wait and the 401 stop", () => {
    expect(mayFlush({ ...base, backoffReady: false, manual: true })).toBe(true);
    expect(mayFlush({ ...base, signedOut: true, manual: true })).toBe(true);
  });
});
