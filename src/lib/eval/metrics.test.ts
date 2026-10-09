import { describe, expect, it } from "vitest";
import {
  accuracy,
  agreement,
  batteryPer100Houses,
  cohenKappa,
  confusionMatrix,
  normalizeName,
  perLanguageAccuracy,
  sameNeeds,
  scoreVoice,
  seconds,
  type LabelPair,
  type PhotoResult,
  type VoiceFields,
} from "./metrics";

const pair = (a: LabelPair["a"], b: LabelPair["b"]): LabelPair => ({ a, b });

// 10 made-up photos: 8 agreed. Labeler A used none 4, partial 3, total 3.
// Labeler B used none 3, partial 3, total 4. Chance agreement is
// 0.4*0.3 + 0.3*0.3 + 0.3*0.4 = 0.33, so kappa is (0.8 - 0.33) / 0.67.
const pairs: LabelPair[] = [
  ...Array(3).fill(pair("none", "none")),
  pair("none", "partial"),
  ...Array(2).fill(pair("partial", "partial")),
  pair("partial", "total"),
  ...Array(3).fill(pair("total", "total")),
];

describe("labeler agreement", () => {
  it("is the share of photos with the same label", () => {
    expect(agreement(pairs)).toEqual({ n: 10, agreed: 8, rate: 0.8 });
  });

  it("is null with no photos, not 0", () => {
    expect(agreement([])).toEqual({ n: 0, agreed: 0, rate: null });
  });

  it("gives Cohen's kappa", () => {
    expect(cohenKappa(pairs)).toBeCloseTo(0.47 / 0.67, 10);
  });

  it("gives kappa 1 for full agreement across classes and 0 for chance level", () => {
    expect(cohenKappa([pair("none", "none"), pair("total", "total")])).toBe(1);
    expect(cohenKappa([pair("none", "none"), pair("none", "total"), pair("total", "none"), pair("total", "total")])).toBe(0);
  });

  it("gives null kappa when it is undefined", () => {
    expect(cohenKappa([])).toBeNull();
    expect(cohenKappa([pair("none", "none"), pair("none", "none")])).toBeNull();
  });
});

describe("AI accuracy and confusion matrix", () => {
  const results: PhotoResult[] = [
    { expected: "none", got: "none" },
    { expected: "none", got: "partial" },
    { expected: "partial", got: "partial" },
    { expected: "partial", got: "total" },
    { expected: "partial", got: "unclear" },
    { expected: "total", got: "total" },
    { expected: "total", got: "total" },
  ];

  it("counts unclear as wrong", () => {
    expect(accuracy(results)).toEqual({ n: 7, correct: 4, rate: 4 / 7 });
    expect(accuracy([])).toEqual({ n: 0, correct: 0, rate: null });
  });

  it("puts the labeled class on rows and the AI answer on columns, with unclear on its own", () => {
    expect(confusionMatrix(results)).toEqual({
      none: { none: 1, partial: 1, total: 0, unclear: 0 },
      partial: { none: 0, partial: 1, total: 1, unclear: 1 },
      total: { none: 0, partial: 0, total: 2, unclear: 0 },
    });
  });

  it("returns an all-zero matrix with no results", () => {
    const matrix = confusionMatrix([]);
    expect(Object.values(matrix).flatMap((row) => Object.values(row)).every((n) => n === 0)).toBe(true);
  });
});

describe("seconds", () => {
  it("gives mean and median, for odd and even counts", () => {
    expect(seconds([3, 1, 2])).toEqual({ n: 3, mean: 2, median: 2 });
    expect(seconds([1, 2, 3, 10])).toEqual({ n: 4, mean: 4, median: 2.5 });
    expect(seconds([])).toEqual({ n: 0, mean: null, median: null });
  });
});

describe("voice scoring", () => {
  const expected: VoiceFields = { household_head: "Ramon Dela Cruz", people: 5, hurt: 2, missing: 0, needs: ["water", "food"] };

  it("matches names ignoring case, accents, punctuation and word order", () => {
    expect(normalizeName("  Dela Cruz,  RAMON ")).toBe(normalizeName("ramon dela cruz"));
    expect(normalizeName("José Niño")).toBe(normalizeName("jose nino"));
    expect(normalizeName("Ramonn Dela Cruz")).not.toBe(normalizeName("Ramon Dela Cruz"));
  });

  it("matches needs as sets", () => {
    expect(sameNeeds(["water", "food"], ["food", "water", "water"])).toBe(true);
    expect(sameNeeds(["water", "food"], ["water"])).toBe(false);
    expect(sameNeeds([], [])).toBe(true);
  });

  it("scores each field, with exact numbers", () => {
    const got: VoiceFields = { household_head: "dela cruz ramon", people: 4, hurt: 2, missing: null, needs: ["food"] };
    expect(scoreVoice(expected, got)).toEqual({ household_head: true, people: false, hurt: true, missing: false, needs: false });
  });

  it("does not score a field with no expected value, and scores a failed read as all wrong", () => {
    const blank: VoiceFields = { household_head: null, people: null, hurt: 1, missing: null, needs: [] };
    expect(scoreVoice(blank, { household_head: "Anyone", people: 9, hurt: 1, missing: 3, needs: [] })).toEqual({
      household_head: null,
      people: null,
      hurt: true,
      missing: null,
      needs: true,
    });
    expect(scoreVoice(expected, null)).toEqual({ household_head: false, people: false, hurt: false, missing: false, needs: false });
  });

  it("gives accuracy per language, with every language present", () => {
    const right = { household_head: true, people: true, hurt: true, missing: true, needs: true };
    const byLanguage = perLanguageAccuracy([
      { language: "tl", fields: right, seconds: 4 },
      { language: "tl", fields: { ...right, people: false, needs: false }, seconds: 6 },
      { language: "ceb", fields: { ...right, household_head: null }, seconds: 5 },
    ]);
    expect(byLanguage.tl).toMatchObject({ notes: 2, fields_scored: 10, fields_right: 8, field_accuracy: 0.8, notes_all_right: 1, all_right_rate: 0.5 });
    expect(byLanguage.tl.by_field.people).toEqual({ scored: 2, right: 1, rate: 0.5 });
    expect(byLanguage.tl.seconds).toEqual({ n: 2, mean: 5, median: 5 });
    expect(byLanguage.ceb).toMatchObject({ notes: 1, fields_scored: 4, field_accuracy: 1, all_right_rate: 1 });
    expect(byLanguage.en).toMatchObject({ notes: 0, field_accuracy: null, all_right_rate: null });
    expect(Object.keys(byLanguage)).toEqual(["tl", "ceb", "mixed", "en"]);
  });
});

describe("battery per 100 houses", () => {
  const unplugged = (percent: number) => ({ percent, charging: false });

  it("scales the drop to 100 houses and gives houses per full charge", () => {
    // 2% over 5 houses is 0.4% a house: 40% per 100 houses, 250 houses a charge.
    expect(batteryPer100Houses(unplugged(80), unplugged(78), 5)).toMatchObject({
      percent_per_100_houses: 40,
      houses_per_full_charge: 250,
      reason: null,
    });
  });

  it("is null when plugged in, on an unknown power source or without a percent", () => {
    for (const [before, after] of [
      [{ percent: 80, charging: true }, unplugged(78)],
      [unplugged(80), { percent: 78, charging: true }],
      [{ percent: 80, charging: null }, { percent: 78, charging: null }],
      [{ percent: null, charging: null }, { percent: null, charging: null }],
      [unplugged(80), { percent: null, charging: false }],
    ] as const) {
      expect(batteryPer100Houses(before, after, 50)).toMatchObject({ percent_per_100_houses: null, houses_per_full_charge: null });
    }
  });

  it("is null when the percent did not drop, and says why", () => {
    expect(batteryPer100Houses(unplugged(80), unplugged(80), 50).reason).toMatch(/whole percent/);
    expect(batteryPer100Houses(unplugged(80), unplugged(81), 50).reason).toMatch(/went up/);
    expect(batteryPer100Houses(unplugged(80), unplugged(70), 0).reason).toMatch(/No photos/);
  });
});
