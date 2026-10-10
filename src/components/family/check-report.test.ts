import { describe, expect, it } from "vitest";
import { emptyDraft, type ReportDraft } from "./report-draft";
import { checkBackHref, EDIT_LIMITS, householdRows, isBlankDraft, NEED_OPTIONS, setCount, setHead, setNeed, setPlace, setWhatHappened, whatHappened } from "./check-report";

const draft: ReportDraft = {
  ...emptyDraft(),
  household_head: "Rosa Dela Cruz",
  barangay: "San Isidro",
  purok: "Purok 3",
  people: 5,
  hurt: 1,
  what_happened: "The roof is gone.",
  needs: ["water", "tarp"],
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
  it("shows what the family wrote, or Not set", () => {
    expect(whatHappened(draft)).toBe("The roof is gone.");
    expect(whatHappened({ ...draft, what_happened: "" })).toBe("Not set");
  });
});

describe("setCount", () => {
  it("changes the count", () => {
    expect(setCount(draft, "hurt", 2).hurt).toBe(2);
  });
});

describe("setHead", () => {
  it("trims the name", () => {
    expect(setHead(draft, "  Rosa Reyes ").household_head).toBe("Rosa Reyes");
  });

  it("stops at the length the report accepts", () => {
    expect(setHead(draft, "a".repeat(200)).household_head).toHaveLength(EDIT_LIMITS.household_head);
  });
});

describe("setPlace", () => {
  it("changes the barangay and purok", () => {
    expect(setPlace(draft, "Mabini", " Purok 5 ")).toMatchObject({ barangay: "Mabini", purok: "Purok 5" });
  });
});

describe("setWhatHappened", () => {
  it("saves the trimmed text", () => {
    expect(setWhatHappened(draft, " The roof is gone and water came in. ").what_happened).toBe("The roof is gone and water came in.");
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
});

describe("isBlankDraft", () => {
  it("is true only when the household step was skipped", () => {
    expect(isBlankDraft(emptyDraft())).toBe(true);
    expect(isBlankDraft({ ...emptyDraft(), barangay: "San Isidro" })).toBe(false);
    expect(isBlankDraft(draft)).toBe(false);
  });
});

describe("NEED_OPTIONS", () => {
  it("lists the six needs with their labels", () => {
    expect(NEED_OPTIONS.map((n) => n.label)).toEqual(["Water", "Food", "Tarp", "Medicine", "Hygiene kit", "Baby needs"]);
  });
});

describe("checkBackHref", () => {
  it("goes back to the household step", () => {
    expect(checkBackHref()).toBe("/report");
  });
});
