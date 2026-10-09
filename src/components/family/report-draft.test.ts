import { describe, expect, it } from "vitest";
import { DRAFT_KEY, clearDraft, emptyDraft, loadDraft, draftFromReport, saveDraft, toNewReport } from "./report-draft";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe("report draft", () => {
  it("starts empty when nothing is stored, on the server or after bad data", () => {
    expect(loadDraft(null)).toEqual(emptyDraft());
    expect(loadDraft(memoryStorage())).toEqual(emptyDraft());
    expect(loadDraft(memoryStorage({ [DRAFT_KEY]: "{not json" }))).toEqual(emptyDraft());
    expect(loadDraft(memoryStorage({ [DRAFT_KEY]: JSON.stringify({ people: "many" }) }))).toEqual(emptyDraft());
  });

  it("keeps the choice and fields between steps", () => {
    const storage = memoryStorage();
    saveDraft({ source: "neighbor", barangay: "San Isidro", purok: "Purok 3" }, storage);
    saveDraft({ lat: 10.31, lng: 123.88 }, storage);
    expect(loadDraft(storage)).toMatchObject({ source: "neighbor", barangay: "San Isidro", purok: "Purok 3", lat: 10.31, lng: 123.88 });
    clearDraft(storage);
    expect(loadDraft(storage)).toEqual(emptyDraft());
  });

  it("does not throw when the store is full or blocked", () => {
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(saveDraft({ people: 4 }, blocked).people).toBe(4);
    expect(() => clearDraft(blocked)).not.toThrow();
  });

  it("builds a NewReport with consent, and blanks become null", () => {
    const draft = { ...emptyDraft(), household_head: "Dela Cruz", barangay: "San Isidro", purok: "  ", what_happened: "Roof gone" };
    const result = toNewReport(draft);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ source: "family", consent: true, purok: null, reporter_name: null, reporter_where: null });
    // A family report never carries a voice note transcript. Only the help desk records one.
    expect(result.data).toMatchObject({ transcript: null, english: null, language: null });
  });

  it("carries the reporter only for a neighbor's report", () => {
    const base = { ...emptyDraft(), household_head: "Reyes", barangay: "Mabini", reporter_name: "Ana Cruz", reporter_where: "Chapel" };
    const own = toNewReport(base);
    const neighbor = toNewReport({ ...base, source: "neighbor" });
    expect(own.success && own.data.reporter_name).toBeNull();
    expect(neighbor.success && neighbor.data).toMatchObject({ source: "neighbor", reporter_name: "Ana Cruz", reporter_where: "Chapel" });
  });

  it("refuses to build a report without a household head or barangay", () => {
    expect(toNewReport(emptyDraft()).success).toBe(false);
    expect(toNewReport({ ...emptyDraft(), household_head: "Reyes" }).success).toBe(false);
  });
});

describe("draftFromReport", () => {
  it("gives back the draft a report was made from, so a refused report can be fixed", () => {
    const draft = {
      ...emptyDraft(),
      source: "neighbor" as const,
      household_head: "Dela Cruz",
      barangay: "San Isidro",
      purok: "Purok 3",
      reporter_name: "Ana",
      reporter_where: "Chapel",
      people: 5,
      hurt: 1,
      what_happened: "Roof gone",
      needs: ["water" as const],
    };
    const body = toNewReport(draft);
    if (!body.success) throw new Error("fixture draft is not a valid report");
    expect(draftFromReport(body.data)).toEqual(draft);
    expect(draftFromReport({ ...body.data, source: "desk" }).source).toBe("family");
  });
});
