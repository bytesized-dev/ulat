import { describe, expect, it } from "vitest";
import { AiVoiceExtract } from "@/lib/contracts";
import fixtures from "../../../seed/ai-fixtures.json";
import { DRAFT_KEY, applyExtract, clearDraft, emptyDraft, loadDraft, markChecked, saveDraft, toNewReport } from "./report-draft";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const voice = AiVoiceExtract.parse(fixtures.voice);

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

  it("fills the draft from the voice note and keeps what the model left empty", () => {
    const start = { ...emptyDraft(), barangay: "San Isidro", household_head: "Typed name", people: 3 };
    const filled = applyExtract(start, { ...voice, household_head: null, people: null, needs: [] });
    expect(filled).toMatchObject({ barangay: "San Isidro", household_head: "Typed name", people: 3, needs: [] });
    expect(filled.transcript).toBe(voice.transcript);
    expect(filled.uncertain_fields).toEqual(voice.uncertain_fields);

    const full = applyExtract(start, voice);
    expect(full.household_head).toBe(voice.household_head ?? "Typed name");
    expect(full.needs).toEqual(voice.needs.length > 0 ? voice.needs : []);
  });

  it("drops the Please check marker once a field is edited", () => {
    const draft = { ...emptyDraft(), uncertain_fields: ["people", "hurt"] as const };
    expect(markChecked({ ...draft, uncertain_fields: [...draft.uncertain_fields] }, "people").uncertain_fields).toEqual(["hurt"]);
  });

  it("builds a NewReport with consent, and blanks become null", () => {
    const draft = { ...applyExtract(emptyDraft(), voice), household_head: "Dela Cruz", barangay: "San Isidro", purok: "  " };
    const result = toNewReport(draft);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ source: "family", consent: true, purok: null, reporter_name: null, reporter_where: null });
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
