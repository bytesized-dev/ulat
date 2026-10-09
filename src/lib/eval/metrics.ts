import type { AiVoiceExtract } from "@/lib/contracts";

// The math behind eval/results.json. Pure functions on plain values, so every
// number the AI check page shows can be checked by hand. Nothing is rounded:
// rates are fractions from 0 to 1 and the page decides how to show them.
// A rate with nothing to divide by is null, never 0.

export const PHOTO_CLASSES = ["none", "partial", "total"] as const;
export type PhotoClass = (typeof PHOTO_CLASSES)[number];

/** The columns of the confusion matrix. "unclear" is the AI's own column. */
export const MATRIX_COLUMNS = [...PHOTO_CLASSES, "unclear"] as const;
export type MatrixColumn = (typeof MATRIX_COLUMNS)[number];

const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole);

/* ---------- Photos ---------- */

export type LabelPair = { a: PhotoClass; b: PhotoClass };

/** The share of photos where both people chose the same class. Pass only photos with both labels. */
export function agreement(pairs: LabelPair[]) {
  const agreed = pairs.filter((pair) => pair.a === pair.b).length;
  return { n: pairs.length, agreed, rate: ratio(agreed, pairs.length) };
}

/**
 * Cohen's kappa: agreement beyond what two labelers would reach by chance,
 * given how often each used each class. Null when it is undefined, which is
 * no pairs, or both people always using one and the same class.
 */
export function cohenKappa(pairs: LabelPair[]): number | null {
  const n = pairs.length;
  if (n === 0) return null;
  const observed = pairs.filter((pair) => pair.a === pair.b).length / n;
  let chance = 0;
  for (const cls of PHOTO_CLASSES) {
    const a = pairs.filter((pair) => pair.a === cls).length / n;
    const b = pairs.filter((pair) => pair.b === cls).length / n;
    chance += a * b;
  }
  if (chance === 1) return null;
  return (observed - chance) / (1 - chance);
}

export type PhotoResult = { expected: PhotoClass; got: MatrixColumn };

/** AI accuracy on photos the labelers agreed on. "unclear" counts as wrong. */
export function accuracy(results: PhotoResult[]) {
  const correct = results.filter((result) => result.expected === result.got).length;
  return { n: results.length, correct, rate: ratio(correct, results.length) };
}

export type ConfusionMatrix = Record<PhotoClass, Record<MatrixColumn, number>>;

/** Rows are the labeled class, columns are what the AI said. */
export function confusionMatrix(results: PhotoResult[]): ConfusionMatrix {
  const matrix = Object.fromEntries(
    PHOTO_CLASSES.map((row) => [row, Object.fromEntries(MATRIX_COLUMNS.map((col) => [col, 0]))]),
  ) as ConfusionMatrix;
  for (const result of results) matrix[result.expected][result.got]++;
  return matrix;
}

/* ---------- Timing ---------- */

export function seconds(values: number[]) {
  if (values.length === 0) return { n: 0, mean: null, median: null };
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return { n: values.length, mean, median };
}

/* ---------- Voice ---------- */

/** The languages the AI check page lists. These are the codes in voice.csv. */
export const VOICE_LANGUAGES = ["tl", "ceb", "mixed", "en"] as const;
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number];

/** The fields that count toward voice accuracy. what_happened is left out: it is free text. */
export const SCORED_FIELDS = ["household_head", "people", "hurt", "missing", "needs"] as const;
export type ScoredField = (typeof SCORED_FIELDS)[number];

export type VoiceFields = Pick<AiVoiceExtract, "household_head" | "people" | "hurt" | "missing" | "needs">;

/**
 * Compares names ignoring case, accents, punctuation, extra spaces and word
 * order, so "Dela Cruz, Ramon" matches "ramon dela cruz". It does not fix
 * spelling: "Ramon" and "Ramonn" do not match.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/** True when both lists hold the same needs. Order and repeats do not matter. */
export function sameNeeds(expected: readonly string[], got: readonly string[]): boolean {
  const a = new Set(expected);
  const b = new Set(got);
  return a.size === b.size && [...a].every((need) => b.has(need));
}

export type FieldScores = Record<ScoredField, boolean | null>;

/**
 * Scores one note. Numbers and needs are exact matches, household_head is a
 * normalized match. A field with no expected value is null: not scored. A
 * field the AI left empty when something was expected is wrong. Needs are
 * always scored, so an empty expected list means "no needs".
 */
export function scoreVoice(expected: VoiceFields, got: VoiceFields | null): FieldScores {
  const number = (key: "people" | "hurt" | "missing") =>
    expected[key] === null ? null : got?.[key] === expected[key];
  return {
    household_head:
      expected.household_head === null
        ? null
        : got?.household_head != null && normalizeName(got.household_head) === normalizeName(expected.household_head),
    people: number("people"),
    hurt: number("hurt"),
    missing: number("missing"),
    needs: got !== null && sameNeeds(expected.needs, got.needs),
  };
}

export type VoiceResult = { language: VoiceLanguage; fields: FieldScores; seconds: number };

export type LanguageRow = {
  notes: number;
  fields_scored: number;
  fields_right: number;
  field_accuracy: number | null;
  notes_all_right: number;
  all_right_rate: number | null;
  by_field: Record<string, { scored: number; right: number; rate: number | null }>;
  seconds: ReturnType<typeof seconds>;
};

/** Field accuracy per language, plus how many notes had every scored field right. */
export function perLanguageAccuracy(results: VoiceResult[]) {
  return Object.fromEntries(
    VOICE_LANGUAGES.map((language) => {
      const notes = results.filter((result) => result.language === language);
      const scores = notes.flatMap((note) => Object.values(note.fields)).filter((score) => score !== null);
      const fieldsRight = scores.filter(Boolean).length;
      const allRight = notes.filter((note) => Object.values(note.fields).every((score) => score !== false)).length;
      const byField = Object.fromEntries(
        SCORED_FIELDS.map((field) => {
          const scored = notes.map((note) => note.fields[field]).filter((score) => score !== null);
          const right = scored.filter(Boolean).length;
          return [field, { scored: scored.length, right, rate: ratio(right, scored.length) }];
        }),
      );
      return [
        language,
        {
          notes: notes.length,
          fields_scored: scores.length,
          fields_right: fieldsRight,
          field_accuracy: ratio(fieldsRight, scores.length),
          notes_all_right: allRight,
          all_right_rate: ratio(allRight, notes.length),
          by_field: byField,
          seconds: seconds(notes.map((note) => note.seconds)),
        },
      ];
    }),
  ) as Record<VoiceLanguage, LanguageRow>;
}

/* ---------- Battery ---------- */

export type BatteryReading = { percent: number | null; charging: boolean | null };

/**
 * Battery used per 100 houses, from a reading before and after the photo run.
 * Null when the number cannot be trusted: the hub was plugged in or its power
 * source is unknown, the probe gave no percent, the percent went up, or it did
 * not move at all. pmset reports whole percents, so a short run can read 0%.
 * Houses per full charge is 100 divided by the percent used per house.
 */
export function batteryPer100Houses(before: BatteryReading, after: BatteryReading, houses: number) {
  const none = (reason: string) => ({
    houses,
    before,
    after,
    percent_per_100_houses: null,
    houses_per_full_charge: null,
    reason,
  });
  if (houses <= 0) return none("No photos were assessed.");
  if (before.percent === null || after.percent === null) return none("The battery probe gave no percent.");
  if (before.charging !== false || after.charging !== false) {
    return none("The hub was on AC power, or the power source is unknown. Unplug it and run again.");
  }
  const used = before.percent - after.percent;
  if (used < 0) return none("The battery percent went up during the run.");
  if (used === 0) return none("The battery did not drop a whole percent. Run more photos.");
  const perHouse = used / houses;
  return {
    houses,
    before,
    after,
    percent_per_100_houses: perHouse * 100,
    houses_per_full_charge: 100 / perHouse,
    reason: null,
  };
}
