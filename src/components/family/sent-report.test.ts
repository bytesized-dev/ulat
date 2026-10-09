import { describe, expect, it } from "vitest";
import { SENT_KEY, clearSentReport, markSentFromDraft, parseSentReport, readSentRaw, saveSentReport, takeSentFromDraft } from "./sent-report";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const at = new Date("2026-10-09T06:14:00.000Z");

describe("sent report", () => {
  it("keeps the code and the time it was sent", () => {
    const storage = memoryStorage();
    expect(saveSentReport("K7P4", at, storage)).toEqual({ code: "K7P4", sent_at: "2026-10-09T06:14:00.000Z" });
    expect(parseSentReport(readSentRaw(storage))).toEqual({ code: "K7P4", sent_at: "2026-10-09T06:14:00.000Z" });
    clearSentReport(storage);
    expect(parseSentReport(readSentRaw(storage))).toBeNull();
  });

  it("ignores anything that is not a code the hub would give", () => {
    expect(saveSentReport("K7P1", at, memoryStorage())).toBeNull();
    expect(parseSentReport(null)).toBeNull();
    expect(parseSentReport("{not json")).toBeNull();
    expect(parseSentReport(JSON.stringify({ code: "OOOO", sent_at: at.toISOString() }))).toBeNull();
    expect(parseSentReport(JSON.stringify({ code: "K7P4", sent_at: "yesterday" }))).toBeNull();
    expect(parseSentReport(memoryStorage({ [SENT_KEY]: "[]" }).getItem(SENT_KEY))).toBeNull();
  });

  it("still returns the report when the store is blocked, and shows it for this page load", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(saveSentReport("K7P4", at, blocked)).toMatchObject({ code: "K7P4" });
    expect(parseSentReport(readSentRaw(blocked))).toMatchObject({ code: "K7P4" });
    expect(() => clearSentReport(blocked)).not.toThrow();
    expect(readSentRaw(null)).toBeNull();
  });
});

describe("sent from this draft", () => {
  it("lets the draft go once, for the report that was just sent", () => {
    expect(takeSentFromDraft("K7P4")).toBe(false);
    markSentFromDraft("K7P4");
    expect(takeSentFromDraft("K7P4")).toBe(true);
    expect(takeSentFromDraft("K7P4")).toBe(false);
  });

  it("keeps the draft when an older report is opened by its address", () => {
    markSentFromDraft("K7P4");
    expect(takeSentFromDraft("M3Q8")).toBe(false);
    expect(takeSentFromDraft("K7P4")).toBe(true);
  });
});
