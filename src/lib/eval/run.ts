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
  | "expected_invalid"
  /** Ollama could not be reached or answered with an error, so the model did no work on it. */
  | "unavailable";

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
 * "unclear". Ollama failing to serve the call (no connection, a 5xx, 408 or
 * 429) is not a verdict on the model, so it is an error and stays out of the
 * scores. `status` is the HTTP status when Ollama answered, null when the
 * connection failed.
 */
function failureKind(error: unknown): { kind: string; asUnclear: boolean; unavailable: boolean; status: number | null } {
  if (error instanceof OllamaError) {
    const unavailable = error.kind === "unavailable";
    return { kind: error.kind, asUnclear: !unavailable, unavailable, status: error.status };
  }
  return { kind: error instanceof Error ? error.message : "unknown", asUnclear: false, unavailable: false, status: null };
}

/** The run stops after this many calls in a row that could not reach Ollama. */
export const MAX_UNAVAILABLE_IN_A_ROW = 3;

/**
 * Reads how many photo calls to make from `--repeat N` (or `--repeat=N`), then
 * from EVAL_REPEAT. Returns undefined when neither is set. Throws on anything
 * that is not a whole number of at least 1.
 */
export function parseRepeat(argv: readonly string[], env: Record<string, string | undefined>): number | undefined {
  const index = argv.findIndex((arg) => arg === "--repeat" || arg.startsWith("--repeat="));
  let raw: string | undefined;
  let source = "EVAL_REPEAT";
  if (index >= 0) {
    source = "--repeat";
    raw = argv[index].includes("=") ? argv[index].slice("--repeat=".length) : argv[index + 1];
  } else raw = env.EVAL_REPEAT;
  if (raw === undefined || raw.trim() === "") {
    if (index >= 0) throw new Error("--repeat needs a number, for example --repeat 100.");
    return undefined;
  }
  if (!/^\d+$/.test(raw.trim()) || Number(raw) < 1) {
    throw new Error(`${source} must be a whole number of at least 1, got "${raw}".`);
  }
  return Number(raw);
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

/**
 * `repeat` is the number of photo calls to make in all. The photo set runs
 * once in full first, then loops until that many calls are done, so the battery
 * has enough houses to drop a whole percent. Only the first pass is scored.
 */
export async function runEval(options: { dir: string; model: string; deps: EvalDeps; repeat?: number; now?: () => Date }) {
  const { dir, deps } = options;
  const log = deps.log ?? (() => {});
  const skipped: Skipped[] = [];
  let attempts = 0;
  let unavailable = 0;
  let unavailableInARow = 0;
  let answeredWithError = false;

  // Ollama being down is not a verdict on the model. The call is listed as
  // skipped and stays out of timing and out of the houses, and a run that keeps
  // hitting it stops, so one dead server cannot fill the numbers with 0 s calls.
  // "Could not be reached" is only for a failed connection. An Ollama that
  // answered with an error is up, so the message says what it answered.
  const skipUnavailable = (kind: Skipped["kind"], file: string, error: unknown) => {
    const { status } = failureKind(error);
    unavailable++;
    if (status !== null) answeredWithError = true;
    skipped.push({ kind, file, reason: "unavailable", ran: false });
    if (++unavailableInARow >= MAX_UNAVAILABLE_IN_A_ROW) {
      throw new Error(
        status === null
          ? `Ollama could not be reached for ${MAX_UNAVAILABLE_IN_A_ROW} calls in a row, so the run stopped and nothing was written. Start Ollama and run again.`
          : `Ollama answered with an error (HTTP ${status}) for ${MAX_UNAVAILABLE_IN_A_ROW} calls in a row, so the run stopped and nothing was written. Check the Ollama log and run again.`,
      );
    }
  };

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
  // Every photo call the model really made, in every pass. This is the houses
  // for the battery and the sample for the timing.
  const photoSeconds: number[] = [];
  const photoSet: { file: string; data: Buffer; mime: string }[] = [];

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
    photoSet.push({ file: row.file, data, mime });

    // Which labels let this photo into the scores, and why not if it did not.
    // The labels are about the people, so they count even if the call fails.
    let expected: PhotoClass | null = null;
    let labelSkip: SkipReason | null = null;
    if (a === "missing" && b === "missing") labelSkip = "both_labels_missing";
    else if (a === "missing") labelSkip = "label_a_missing";
    else if (b === "missing") labelSkip = "label_b_missing";
    else if (a === "invalid" || b === "invalid") labelSkip = "label_invalid";
    else {
      pairs.push({ a, b });
      if (a === b) expected = a;
      else labelSkip = "labelers_disagree";
    }

    log(`Photo ${i + 1} of ${photoRows.length}: ${row.file}`);
    attempts++;
    const result = await timed(deps, () => deps.draftPhoto({ photos: [{ data, mime, label: "" }] }));
    const failure = result.error ? failureKind(result.error) : null;
    if (failure?.unavailable) {
      skipUnavailable("photo", row.file, result.error);
      continue;
    }
    unavailableInARow = 0;
    photoSeconds.push(result.seconds);
    if (failure) photoCallsFailed++;
    const got: PhotoResult["got"] | null = result.value ? result.value.damage_class : failure?.asUnclear ? "unclear" : null;

    if (labelSkip) skipped.push({ kind: "photo", file: row.file, reason: labelSkip, ran: true });
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

  // More passes for the power number only. They add to the timing and the
  // houses, never to the items, the scores or the confusion matrix.
  const wanted = options.repeat ?? 0;
  while (photoSet.length > 0 && photoSeconds.length < wanted) {
    for (const { file, data, mime } of photoSet) {
      if (photoSeconds.length >= wanted) break;
      log(`Photo repeat ${photoSeconds.length + 1} of ${wanted}: ${file}`);
      attempts++;
      const result = await timed(deps, () => deps.draftPhoto({ photos: [{ data, mime, label: "" }] }));
      if (result.error && failureKind(result.error).unavailable) {
        skipUnavailable("photo", file, result.error);
        continue;
      }
      unavailableInARow = 0;
      photoSeconds.push(result.seconds);
    }
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
    got: (VoiceFields & { what_happened: string | null; language: string; transcript: string; english: string }) | null;
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
    if (failure?.unavailable) {
      skipUnavailable("voice", row.file, result.error);
      continue;
    }
    unavailableInARow = 0;
    if (failure) voiceCallsFailed++;

    // A note the model could not read scores as every field wrong. An error
    // that is not the model's reply scores nothing.
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
            // Kept so a person can judge the transcription by hand. Not scored.
            transcript: got.transcript,
            english: got.english,
          }
        : null,
      fields,
      error: failure?.kind ?? null,
      seconds: result.seconds,
    });
  }

  if (attempts > 0 && unavailable === attempts) {
    throw new Error(
      answeredWithError
        ? "Every call failed because Ollama was down or answered with an error. Check the Ollama log and run again."
        : "Every call failed because Ollama could not be reached. Start Ollama and run again.",
    );
  }

  const photosRun = photoItems.length;
  const photoCalls = photoSeconds.length;
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
        calls: photoCalls,
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
      seconds: seconds(photoSeconds),
      items: photoItems,
    },
    voice: {
      languages: perLanguageAccuracy(voiceResults),
      seconds: seconds(voiceResults.map((result) => result.seconds)),
      items: voiceItems,
    },
    battery: batteryPer100Houses(batteryBefore, batteryAfter, photoCalls),
  };
}

export type EvalResults = Awaited<ReturnType<typeof runEval>>;
