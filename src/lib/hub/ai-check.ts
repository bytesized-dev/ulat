import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { EvalResults } from "../eval/run";
import { formatRate } from "./kit-format";

// The AI check page shows eval/results.json, which `pnpm eval` writes. SPEC
// section 11. This module only reads that file. It never calls the model, and
// it never works out a number: every figure on the page is one the file holds.
//
// The file has no contract in src/lib/contracts, so the schema below checks
// the part of it the page shows. Keys it does not list are dropped. The check
// at the bottom makes tsc fail if `pnpm eval` stops writing any key listed here.

export const RESULTS_PATH = "eval/results.json";

const Rate = z.number().min(0).max(1).nullable();
const Count = z.number().int().min(0);
const Seconds = z.object({ n: Count, mean: z.number().nullable(), median: z.number().nullable() });
const MatrixRow = z.object({ none: Count, partial: Count, total: Count, unclear: Count });
const Language = z.object({ notes: Count, all_right_rate: Rate });

export const EvalResultsFile = z.object({
  generated_at: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "not a date"),
  model: z.string(),
  counts: z.object({
    photos: z.object({ run: Count, scored: Count }),
    voice: z.object({ run: Count }),
    skipped: Count,
  }),
  photos: z.object({
    agreement: z.object({ n: Count, agreed: Count, rate: Rate }),
    accuracy: z.object({ n: Count, correct: Count, rate: Rate }),
    confusion_matrix: z.object({ none: MatrixRow, partial: MatrixRow, total: MatrixRow }),
    seconds: Seconds,
  }),
  voice: z.object({
    languages: z.object({ tl: Language, ceb: Language, mixed: Language, en: Language }),
  }),
  battery: z.object({
    percent_per_100_houses: z.number().nullable(),
    houses_per_full_charge: z.number().nullable(),
    reason: z.string().nullable(),
  }),
});
export type EvalResultsFile = z.infer<typeof EvalResultsFile>;

// Compile time only: the default below stops compiling when what runEval
// returns no longer fits the schema above.
export type WrittenResults<T extends EvalResultsFile = EvalResults> = T;

export type AiCheckReading =
  | { status: "ok"; results: EvalResultsFile }
  | { status: "missing" }
  | { status: "invalid"; reason: string };

/** The file as the page shows it. Never throws: a missing, unreadable or broken file is a status. */
export async function readEvalResults(path: string = resolve(RESULTS_PATH)): Promise<AiCheckReading> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "missing" };
    return { status: "invalid", reason: "The file could not be read." };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: "invalid", reason: "The file is not valid JSON." };
  }

  const parsed = EvalResultsFile.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length > 0 ? ` at ${issue.path.join(".")}` : "";
    return { status: "invalid", reason: `The file does not have the expected shape${where}.` };
  }
  return { status: "ok", results: parsed.data };
}

export const DAMAGE_CLASSES = [
  { id: "none", label: "None" },
  { id: "partial", label: "Partial" },
  { id: "total", label: "Total" },
] as const;

/** The columns of the damage table. "Unclear" is an answer the AI can give, and it counts as wrong. */
export const AI_ANSWERS = [
  { id: "none", label: "AI none" },
  { id: "partial", label: "AI partial" },
  { id: "total", label: "AI total" },
  { id: "unclear", label: "AI unclear" },
] as const;

export const VOICE_LANGUAGE_ROWS = [
  { id: "tl", label: "Tagalog" },
  { id: "ceb", label: "Bisaya" },
  { id: "mixed", label: "Taglish" },
  { id: "en", label: "English" },
] as const;

/** Photos the AI called partial that people called total, and the other way round. */
export function partialTotalMixups(results: EvalResultsFile): number {
  const matrix = results.photos.confusion_matrix;
  return matrix.partial.total + matrix.total.partial;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Short lines on what the last run showed, each read straight from the file.
 * Nothing here is estimated, and an empty run gives the one line it can.
 */
export function weakSpots(results: EvalResultsFile): string[] {
  const lines: string[] = [];
  const matrix = results.photos.confusion_matrix;

  const mixups = partialTotalMixups(results);
  if (mixups > 0) lines.push(`Partial and total were mixed up on ${plural(mixups, "photo", "photos")}.`);

  const unclear = matrix.none.unclear + matrix.partial.unclear + matrix.total.unclear;
  if (unclear > 0) lines.push(`The AI said unclear on ${plural(unclear, "photo", "photos")}.`);

  const weakest = VOICE_LANGUAGE_ROWS.map((row) => ({ label: row.label, ...results.voice.languages[row.id] }))
    .filter((row) => row.notes > 0 && row.all_right_rate !== null && row.all_right_rate < 1)
    .sort((a, b) => a.all_right_rate! - b.all_right_rate!)[0];
  if (weakest) lines.push(`${weakest.label} notes were the weakest, ${formatRate(weakest.all_right_rate)} all right.`);

  if (results.counts.skipped > 0) lines.push(`${plural(results.counts.skipped, "item was", "items were")} left out of the scores.`);

  if (results.battery.reason) lines.push(results.battery.reason);

  return lines.length > 0 ? lines : ["Nothing stood out in the last run."];
}
