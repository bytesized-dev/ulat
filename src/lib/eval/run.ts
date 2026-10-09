import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Need, type AiPhotoDraft, type AiVoiceExtract } from "@/lib/contracts";
import { OllamaError } from "@/lib/ai/ollama";
import { parseCsv } from "./csv";
import {
  accuracy,
  agreement,
  batteryPer100Houses,
  cohenKappa,
  confusionMatrix,
  perLanguageAccuracy,
  PHOTO_CLASSES,
  scoreVoice,
  seconds,
  VOICE_LANGUAGES,
  type BatteryReading,
  type PhotoClass,
  type PhotoResult,
  type VoiceFields,
  type VoiceLanguage,
  type VoiceResult,
} from "./metrics";

// Runs the eval set through the real photo and voice calls and builds the
// object that goes into eval/results.json. The calls are passed in, so a test
// can run the whole thing on stubs. scripts/eval.ts passes the real ones.
// Data that is missing is skipped and counted, never filled in.

export type EvalDeps = {
  draftPhoto: (input: { photos: { data: Buffer; mime: string; label: string }[] }) => Promise<AiPhotoDraft>;
  readVoice: (input: { audio: Buffer; mime: string }) => Promise<AiVoiceExtract>;
  readBattery: () => Promise<BatteryReading>;
  /** Milliseconds on a clock that only moves forward. */
  clock: () => number;
  /** For the progress lines. Optional. */
  log?: (line: string) => void;
};

export type SkipReason =
  | "file_missing"
  | "label_a_missing"
  | "label_b_missing"
  | "both_labels_missing"
  | "label_invalid"
  | "labelers_disagree"
  | "language_unknown"
  | "expected_invalid";

export type Skipped = {
  kind: "photo" | "voice";
  file: string;
  reason: SkipReason;
  /** True when the AI still ran on it and only the scores leave it out. */
  ran: boolean;
};

const PHOTO_MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const AUDIO_MIME: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm",
};

async function readIfThere(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

const parseLabel = (value: string): PhotoClass | "missing" | "invalid" => {
  const label = value.trim().toLowerCase();
  if (label === "") return "missing";
  return (PHOTO_CLASSES as readonly string[]).includes(label) ? (label as PhotoClass) : "invalid";
};

/**
 * Same rule as the app: a reply that is invalid or too slow reads as
 * "unclear". Ollama being down is not a verdict on the model, so it is an
 * error and stays out of the scores.
 */
function failureKind(error: unknown): { kind: string; asUnclear: boolean } {
  if (error instanceof OllamaError) return { kind: error.kind, asUnclear: error.kind !== "unavailable" };
  return { kind: error instanceof Error ? error.message : "unknown", asUnclear: false };
}

async function timed<T>(deps: EvalDeps, call: () => Promise<T>) {
  const start = deps.clock();
  try {
    const value = await call();
    return { value, error: null, seconds: (deps.clock() - start) / 1000 };
  } catch (error) {
    return { value: null, error, seconds: (deps.clock() - start) / 1000 };
  }
}

export async function runEval(options: { dir: string; model: string; deps: EvalDeps; now?: () => Date }) {
  const { dir, deps } = options;
  const log = deps.log ?? (() => {});
  const skipped: Skipped[] = [];
  let attempts = 0;
  let unavailable = 0;

  /* ---------- Photos ---------- */

  const photoRows = parseCsv(await readFile(join(dir, "labels.csv"), "utf8"), ["file", "label_a", "label_b"]);
  const photoItems: {
    file: string;
    label_a: string | null;
    label_b: string | null;
    expected: PhotoClass | null;
    got: PhotoResult["got"] | null;
    confidence: AiPhotoDraft["confidence"] | null;
    reason: string | null;
    error: string | null;
    seconds: number;
  }[] = [];
  const pairs: { a: PhotoClass; b: PhotoClass }[] = [];
  const scored: PhotoResult[] = [];
  let photoFilesMissing = 0;
  let photoCallsFailed = 0;

  const batteryBefore = await deps.readBattery();
  for (const [i, row] of photoRows.entries()) {
    const data = await readIfThere(join(dir, row.file));
    if (!data) {
      photoFilesMissing++;
      skipped.push({ kind: "photo", file: row.file, reason: "file_missing", ran: false });
      continue;
    }
    const a = parseLabel(row.label_a);
    const b = parseLabel(row.label_b);
    const mime = PHOTO_MIME[extname(row.file).toLowerCase()] ?? "image/jpeg";

    log(`Photo ${i + 1} of ${photoRows.length}: ${row.file}`);
    attempts++;
    const result = await timed(deps, () => deps.draftPhoto({ photos: [{ data, mime, label: "" }] }));
    const failure = result.error ? failureKind(result.error) : null;
    if (failure && !failure.asUnclear) unavailable++;
    if (failure) photoCallsFailed++;
    const got: PhotoResult["got"] | null = result.value ? result.value.damage_class : failure?.asUnclear ? "unclear" : null;

    // Which labels let this photo into the scores, and why not if it did not.
    let expected: PhotoClass | null = null;
    if (a === "missing" && b === "missing") skipped.push({ kind: "photo", file: row.file, reason: "both_labels_missing", ran: true });
    else if (a === "missing") skipped.push({ kind: "photo", file: row.file, reason: "label_a_missing", ran: true });
    else if (b === "missing") skipped.push({ kind: "photo", file: row.file, reason: "label_b_missing", ran: true });
    else if (a === "invalid" || b === "invalid") skipped.push({ kind: "photo", file: row.file, reason: "label_invalid", ran: true });
    else {
      pairs.push({ a, b });
      if (a === b) expected = a;
      else skipped.push({ kind: "photo", file: row.file, reason: "labelers_disagree", ran: true });
    }
    if (expected && got) scored.push({ expected, got });

    photoItems.push({
      file: row.file,
      label_a: a === "missing" || a === "invalid" ? null : a,
      label_b: b === "missing" || b === "invalid" ? null : b,
      expected,
      got,
      confidence: result.value?.confidence ?? null,
      reason: result.value?.reason ?? null,
      error: failure?.kind ?? null,
      seconds: result.seconds,
    });
  }
  const batteryAfter = await deps.readBattery();

  /* ---------- Voice ---------- */

  const voiceRows = parseCsv(await readFile(join(dir, "voice.csv"), "utf8"), [
    "file",
    "language",
    "household_head",
    "people",
    "hurt",
    "missing",
    "what_happened",
    "needs",
  ]);
  const voiceItems: {
    file: string;
    language: VoiceLanguage;
    expected: VoiceFields & { what_happened: string | null };
    got: (VoiceFields & { what_happened: string | null; language: string }) | null;
    fields: ReturnType<typeof scoreVoice>;
    error: string | null;
    seconds: number;
  }[] = [];
  const voiceResults: VoiceResult[] = [];
  let voiceFilesMissing = 0;
  let voiceCallsFailed = 0;

  for (const [i, row] of voiceRows.entries()) {
    const language = (VOICE_LANGUAGES as readonly string[]).includes(row.language) ? (row.language as VoiceLanguage) : null;
    if (!language) {
      skipped.push({ kind: "voice", file: row.file, reason: "language_unknown", ran: false });
      continue;
    }
    const numbers = (["people", "hurt", "missing"] as const).map((key) => row[key]);
    const needs = row.needs.split(";").map((need) => need.trim()).filter(Boolean);
    const needsValid = needs.every((need) => Need.safeParse(need).success);
    if (!numbers.every((value) => value === "" || /^\d+$/.test(value)) || !needsValid) {
      skipped.push({ kind: "voice", file: row.file, reason: "expected_invalid", ran: false });
      continue;
    }
    const audio = await readIfThere(join(dir, row.file));
    if (!audio) {
      voiceFilesMissing++;
      skipped.push({ kind: "voice", file: row.file, reason: "file_missing", ran: false });
      continue;
    }
    const count = (value: string) => (value === "" ? null : Number(value));
    const expected = {
      household_head: row.household_head || null,
      people: count(row.people),
      hurt: count(row.hurt),
      missing: count(row.missing),
      needs: needs as VoiceFields["needs"],
      what_happened: row.what_happened || null,
    };
    const mime = AUDIO_MIME[extname(row.file).toLowerCase()] ?? "audio/wav";

    log(`Voice note ${i + 1} of ${voiceRows.length}: ${row.file}`);
    attempts++;
    const result = await timed(deps, () => deps.readVoice({ audio, mime }));
    const failure = result.error ? failureKind(result.error) : null;
    if (failure && !failure.asUnclear) unavailable++;
    if (failure) voiceCallsFailed++;

    // A note the model could not read scores as every field wrong. Ollama
    // being down scores nothing.
    if (failure && !failure.asUnclear) {
      const unscored = { household_head: null, people: null, hurt: null, missing: null, needs: null };
      voiceItems.push({ file: row.file, language, expected, got: null, fields: unscored, error: failure.kind, seconds: result.seconds });
      continue;
    }
    const got = result.value;
    const fields = scoreVoice(expected, got);
    voiceResults.push({ language, fields, seconds: result.seconds });
    voiceItems.push({
      file: row.file,
      language,
      expected,
      got: got
        ? {
            household_head: got.household_head,
            people: got.people,
            hurt: got.hurt,
            missing: got.missing,
            needs: got.needs,
            what_happened: got.what_happened,
            language: got.language,
          }
        : null,
      fields,
      error: failure?.kind ?? null,
      seconds: result.seconds,
    });
  }

  if (attempts > 0 && unavailable === attempts) {
    throw new Error("Every call failed because Ollama could not be reached. Start Ollama and run again.");
  }

  const photosRun = photoItems.length;
  const agreed = agreement(pairs);
  return {
    generated_by: "pnpm eval",
    warning: "Generated by pnpm eval. Never edit these numbers by hand. Run pnpm eval again instead.",
    generated_at: (options.now?.() ?? new Date()).toISOString(),
    model: options.model,
    units: "Rates are fractions from 0 to 1 and are not rounded. Seconds are wall-clock. Battery is percent of a full charge.",
    counts: {
      photos: {
        listed: photoRows.length,
        run: photosRun,
        file_missing: photoFilesMissing,
        call_failed: photoCallsFailed,
        labeled_by_both: pairs.length,
        agreed: agreed.agreed,
        scored: scored.length,
      },
      voice: {
        listed: voiceRows.length,
        run: voiceItems.length,
        file_missing: voiceFilesMissing,
        call_failed: voiceCallsFailed,
        scored: voiceResults.length,
      },
      skipped: skipped.length,
    },
    skipped,
    photos: {
      agreement: { ...agreed, kappa: cohenKappa(pairs) },
      accuracy: accuracy(scored),
      confusion_matrix: confusionMatrix(scored),
      seconds: seconds(photoItems.map((item) => item.seconds)),
      items: photoItems,
    },
    voice: {
      languages: perLanguageAccuracy(voiceResults),
      seconds: seconds(voiceResults.map((result) => result.seconds)),
      items: voiceItems,
    },
    battery: batteryPer100Houses(batteryBefore, batteryAfter, photosRun),
  };
}

export type EvalResults = Awaited<ReturnType<typeof runEval>>;
