import { describe, expect, it } from "vitest";
import {
  buildConfirm,
  canConfirm,
  confidenceWords,
  draftSteps,
  initialForm,
  isDrafted,
  isUnclear,
  matchesReport,
  peopleLine,
  toggle,
  urgencyLabel,
} from "./check-draft";

const entry = {
  damage_class: null,
  material: "light" as const,
  hazards: ["Fallen power line"],
  families: 1,
  people: 5,
  hurt: 1,
  missing: 0,
  needs: ["water" as const],
};

describe("confidenceWords", () => {
  it("says Fairly sure only for high", () => {
    expect(confidenceWords("high")).toBe("Fairly sure");
    expect(confidenceWords("medium")).toBe("Not very sure");
    expect(confidenceWords("low")).toBe("Not very sure");
    expect(confidenceWords(null)).toBe("Not very sure");
  });
});

describe("drafted and unclear", () => {
  it("treats any non-null class as drafted", () => {
    expect(isDrafted({ damage_class: null })).toBe(false);
    expect(isDrafted({ damage_class: "unclear" })).toBe(true);
    expect(isDrafted({ damage_class: "total" })).toBe(true);
    expect(isUnclear({ damage_class: "unclear" })).toBe(true);
    expect(isUnclear({ damage_class: "partial" })).toBe(false);
  });
});

describe("initialForm and canConfirm", () => {
  it("selects the AI class when it is sure", () => {
    const form = initialForm(entry, { damage_class: "total" });
    expect(form.damage_class).toBe("total");
    expect(canConfirm(form)).toBe(true);
  });

  it("leaves the class empty when the AI is unclear, and blocks confirm", () => {
    const form = initialForm(entry, { damage_class: "unclear" });
    expect(form.damage_class).toBeNull();
    expect(canConfirm(form)).toBe(false);
    expect(buildConfirm(form, false)).toBeNull();
  });

  it("keeps a class the responder already saved", () => {
    expect(initialForm({ ...entry, damage_class: "partial" }, { damage_class: "total" }).damage_class).toBe("partial");
  });

  it("falls back to unknown material", () => {
    expect(initialForm({ ...entry, material: null }, { damage_class: "none" }).material).toBe("unknown");
  });
});

describe("buildConfirm", () => {
  it("builds a valid EntryConfirm", () => {
    const result = buildConfirm(initialForm(entry, { damage_class: "total" }), true);
    expect(result?.success).toBe(true);
    expect(result?.success && result.data.new_photo_since_unclear).toBe(true);
  });

  it("fails the contract for an out of range count", () => {
    const form = { ...initialForm(entry, { damage_class: "total" }), people: 120 };
    expect(buildConfirm(form, false)?.success).toBe(false);
  });
});

describe("small helpers", () => {
  it("matches the report only when it has a hurt count", () => {
    expect(matchesReport(1, 1)).toBe(true);
    expect(matchesReport(2, 1)).toBe(false);
    expect(matchesReport(0, null)).toBe(false);
  });

  it("toggles a list item", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
  });

  it("writes the people line", () => {
    expect(peopleLine(5, 1)).toBe("5 people, 1 hurt");
    expect(peopleLine(1, 0)).toBe("1 person");
  });

  it("labels urgency, missing first", () => {
    expect(urgencyLabel(0, 1)).toBe("1 missing");
    expect(urgencyLabel(2, 0)).toBe("2 hurt");
    expect(urgencyLabel(2, 3)).toBe("3 missing");
    expect(urgencyLabel(0, 0)).toBeNull();
  });
});

describe("draftSteps", () => {
  it("runs the model step until the draft lands", () => {
    const steps = draftSteps({ photos: 3, hasNote: true, drafted: false });
    expect(steps.map((s) => s.label)).toEqual(["3 photos and a note", "Note understood", "Reading the photos", "Filling in the entry"]);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "active", "waiting"]);
  });

  it("finishes every step once drafted, and skips the note row with no note", () => {
    const steps = draftSteps({ photos: 1, hasNote: false, drafted: true });
    expect(steps.map((s) => s.label)).toEqual(["1 photo", "Reading the photos", "Filling in the entry"]);
    expect(steps.every((s) => s.state === "done")).toBe(true);
  });
});
