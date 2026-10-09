import { describe, expect, it } from "vitest";
import { emptyDraft, type ReportDraft } from "./report-draft";
import { EDIT_LIMITS, householdRows, isBlankDraft, NEED_OPTIONS, needsCheck, setCount, setHead, setNeed, setPlace, setWhatHappened, whatHappened } from "./check-report";

const draft: ReportDraft = {
  ...emptyDraft(),
  household_head: "Rosa Dela Cruz",
  barangay: "San Isidro",
  purok: "Purok 3",
  people: 5,
  hurt: 1,
  what_happened: "The roof is gone.",
  needs: ["water", "tarp"],
  uncertain_fields: ["hurt"],
};

describe("householdRows", () => {
  it("reads the three rows as the design shows them", () => {
    expect(householdRows({ ...draft, lat: 10.3, lng: 123.9 })).toEqual({
      head: "Rosa Dela Cruz",
      barangay: "San Isidro, Purok 3",
      location: "Near Purok 3",
    });
  });

  it("says Not set for what the family has not given yet", () => {
    expect(householdRows(emptyDraft())).toEqual({ head: "Not set", barangay: "Not set", location: "Not set" });
    expect(householdRows(draft).location).toBe("Not set");
  });

  it("falls back to the barangay when there is no purok", () => {
    expect(householdRows({ ...draft, purok: " ", lat: 10.3, lng: 123.9 }).location).toBe("Near San Isidro");
  });
});

describe("whatHappened", () => {
  it("shows the note, or Not set when the model found no damage", () => {
    expect(whatHappened(draft)).toBe("The roof is gone.");
    expect(whatHappened({ ...draft, what_happened: "" })).toBe("Not set");
  });
});

describe("needsCheck", () => {
  it("marks only the fields the model was not sure about", () => {
    expect(needsCheck(draft, "hurt")).toBe(true);
    expect(needsCheck(draft, "people")).toBe(false);
  });
});

describe("setCount", () => {
  it("changes the count and drops that field's marker only", () => {
    const next = setCount({ ...draft, uncertain_fields: ["hurt", "needs"] }, "hurt", 2);
    expect(next.hurt).toBe(2);
    expect(next.uncertain_fields).toEqual(["needs"]);
  });
});

describe("setHead", () => {
  it("trims the name and drops its marker only", () => {
    const next = setHead({ ...draft, uncertain_fields: ["household_head", "hurt"] }, "  Rosa Reyes ");
    expect(next.household_head).toBe("Rosa Reyes");
    expect(next.uncertain_fields).toEqual(["hurt"]);
  });

  it("stops at the length the report accepts", () => {
    expect(setHead(draft, "a".repeat(200)).household_head).toHaveLength(EDIT_LIMITS.household_head);
  });
});

describe("setPlace", () => {
  it("changes the barangay and purok and leaves the markers alone", () => {
    const next = setPlace(draft, "Mabini", " Purok 5 ");
    expect(next).toMatchObject({ barangay: "Mabini", purok: "Purok 5", uncertain_fields: ["hurt"] });
  });
});

describe("setWhatHappened", () => {
  it("saves the text and drops its marker", () => {
    const next = setWhatHappened({ ...draft, uncertain_fields: ["what_happened"] }, " The roof is gone and water came in. ");
    expect(next.what_happened).toBe("The roof is gone and water came in.");
    expect(next.uncertain_fields).toEqual([]);
  });

  it("stops at the length the report accepts", () => {
    expect(setWhatHappened(draft, "a".repeat(300)).what_happened).toHaveLength(EDIT_LIMITS.what_happened);
  });
});

describe("setNeed", () => {
  it("adds and removes a need in the design order", () => {
    const added = setNeed(draft, "food", true);
    expect(added.needs).toEqual(["water", "food", "tarp"]);
    expect(setNeed(added, "water", false).needs).toEqual(["food", "tarp"]);
  });

  it("does not repeat a need that is already on", () => {
    expect(setNeed(draft, "water", true).needs).toEqual(["water", "tarp"]);
  });

  it("drops the needs marker", () => {
    expect(setNeed({ ...draft, uncertain_fields: ["needs"] }, "food", true).uncertain_fields).toEqual([]);
  });
});

describe("isBlankDraft", () => {
  it("is true only when nothing was entered yet", () => {
    expect(isBlankDraft(emptyDraft())).toBe(true);
    expect(isBlankDraft({ ...emptyDraft(), transcript: "Five of us live here." })).toBe(false);
    expect(isBlankDraft(draft)).toBe(false);
  });
});

describe("NEED_OPTIONS", () => {
  it("lists the six needs with their labels", () => {
    expect(NEED_OPTIONS.map((n) => n.label)).toEqual(["Water", "Food", "Tarp", "Medicine", "Hygiene kit", "Baby needs"]);
  });
});
