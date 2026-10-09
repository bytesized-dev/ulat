import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changesMap, changesOverview, debounce, newerSummary } from "./live-refresh";

const id = "6f1c2c1e-6a3b-4f6e-9a55-0d6b2b9d2c11";

describe("which events refresh the overview", () => {
  it("refreshes on report and entry events that change totals or Latest", () => {
    expect(changesOverview({ type: "report.created", code: "ABCD", urgent: false })).toBe(true);
    expect(changesOverview({ type: "report.updated", code: "ABCD", status: "visited" })).toBe(true);
    expect(changesOverview({ type: "entry.needs_review", entry_id: id })).toBe(true);
    expect(changesOverview({ type: "entry.confirmed", entry_id: id, report_code: null })).toBe(true);
  });

  it("refreshes when a place is saved, since the map shows places", () => {
    expect(changesOverview({ type: "place.saved", place_id: id })).toBe(true);
  });

  it("ignores updates, check-ins and hub status", () => {
    expect(changesOverview(null)).toBe(false);
    expect(changesOverview({ type: "update.posted", update_id: id })).toBe(false);
    expect(changesOverview({ type: "safe.checked_in", id })).toBe(false);
  });
});

describe("which events refresh the map", () => {
  it("refreshes on entry, report and place events that move a pin", () => {
    expect(changesMap({ type: "report.created", code: "ABCD", urgent: false })).toBe(true);
    expect(changesMap({ type: "report.updated", code: "ABCD", status: "visited" })).toBe(true);
    expect(changesMap({ type: "entry.needs_review", entry_id: id })).toBe(true);
    expect(changesMap({ type: "entry.confirmed", entry_id: id, report_code: null })).toBe(true);
    expect(changesMap({ type: "place.saved", place_id: id })).toBe(true);
  });

  it("ignores events the map does not show", () => {
    expect(changesMap(null)).toBe(false);
    expect(changesMap({ type: "update.posted", update_id: id })).toBe(false);
  });
});

describe("debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once after a burst", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d.call();
    d.call();
    vi.advanceTimersByTime(299);
    d.call();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not run once cancelled", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d.call();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("newer summary", () => {
  it("keeps whichever was computed later", () => {
    const old = { as_of: "2026-10-10T06:00:00.000Z", n: 1 };
    const fresh = { as_of: "2026-10-10T06:01:00.000Z", n: 2 };
    expect(newerSummary(null, old)).toBe(old);
    expect(newerSummary(old, fresh)).toBe(fresh);
    expect(newerSummary(fresh, old)).toBe(fresh);
  });
});
