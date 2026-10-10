import { describe, expect, it } from "vitest";
import {
  canConfirm,
  confidenceWords,
  initialForm,
  matchesReport,
  peopleLine,
  startFromReport,
  toggle,
  urgencyLabel,
} from "./entry-form";

const report = {
  ai_class: "partial" as const,
  ai_hazards: ["Fallen power line"],
  verdict_class: null,
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

describe("initialForm and canConfirm", () => {
  it("starts a house with no report empty, and blocks confirm until a class is picked", () => {
    const form = initialForm();
    expect(form).toEqual({ damage_class: null, material: "unknown", hazards: [], families: 1, people: 0, hurt: 0, missing: 0, needs: [] });
    expect(canConfirm(form)).toBe(false);
    expect(canConfirm({ ...form, damage_class: "none" })).toBe(true);
  });

  it("drops a hazard the model wrote as none", () => {
    expect(initialForm({ hazards: ["none", "Flooding", " None "] }).hazards).toEqual(["Flooding"]);
  });
});

describe("startFromReport", () => {
  it("starts from the family's counts and needs and the photo reading", () => {
    const { start, classFrom } = startFromReport(report);
    expect(start).toEqual({ damage_class: "partial", hazards: ["Fallen power line"], people: 5, hurt: 1, missing: 0, needs: ["water"] });
    expect(classFrom).toBe("photo");
  });

  it("takes a staff verdict over the reading", () => {
    const { start, classFrom } = startFromReport({ ...report, verdict_class: "total" });
    expect(start.damage_class).toBe("total");
    expect(classFrom).toBe("staff");
  });

  it("leaves the class for the responder when the reading is unclear or missing", () => {
    expect(startFromReport({ ...report, ai_class: "unclear" })).toMatchObject({ start: { damage_class: null }, classFrom: null });
    expect(startFromReport({ ...report, ai_class: null, ai_hazards: null })).toMatchObject({ start: { damage_class: null, hazards: [] }, classFrom: null });
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
