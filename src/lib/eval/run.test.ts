import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OllamaError } from "@/lib/ai/ollama";
import type { AiPhotoDraft, AiVoiceExtract } from "@/lib/contracts";
import { runEval, type EvalDeps } from "./run";

// A dry run on made-up files and stubbed calls. No model, no network. The
// stubs decide from the file name, which the test writes into each file.

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ulat-eval-"));
  await mkdir(join(dir, "photos"));
  await mkdir(join(dir, "voice"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const LABELS = `file,label_a,label_b,notes
photos/p1.jpg,partial,partial,
photos/p2.jpg,total,total,
photos/p3.jpg,none,partial,"labelers split, judgment call"
photos/p4.jpg,none,,"roof gone, wall down"
photos/p5.jpg,total,total,photo not copied yet
photos/p6.jpg,total,total,
`;

const VOICE = `file,language,household_head,people,hurt,missing,what_happened,needs
voice/tl1.wav,tl,Liza Santos,6,1,2,The roof is gone.,water;medicine
voice/ceb1.wav,ceb,Ramon Dela Cruz,5,2,1,One wall fell.,water;food;tarp
voice/mixed1.wav,mixed,Ana Reyes,3,0,0,Flooded.,water
voice/xx1.wav,xx,Nobody,1,0,0,,
`;

const draft = (damage_class: AiPhotoDraft["damage_class"]): AiPhotoDraft => ({
  damage_class,
  confidence: "high",
  material: "light",
  hazards: [],
  reason: "stub",
  need_more: null,
});

const note = (fields: Partial<AiVoiceExtract>): AiVoiceExtract => ({
  language: "tl",
  transcript: "",
  english: "",
  household_head: null,
  people: null,
  hurt: null,
  missing: null,
  what_happened: null,
  needs: [],
  hazards: [],
  uncertain_fields: [],
  ...fields,
});

function deps(overrides: Partial<EvalDeps> = {}): EvalDeps {
  let t = 0;
  const readings = [
    { percent: 80, charging: false },
    { percent: 78, charging: false },
  ];
  return {
    draftPhoto: async ({ photos }) => {
      const name = photos[0].data.toString();
      if (name === "p6") throw new OllamaError("invalid_output", "not JSON", "oops");
      return draft(({ p1: "partial", p2: "partial", p3: "none", p4: "total" } as const)[name as "p1"] ?? "unclear");
    },
    readVoice: async ({ audio }) =>
      audio.toString() === "tl1"
        ? note({ household_head: "Liza Santos", people: 6, hurt: 1, missing: 2, needs: ["medicine", "water"] })
        : note({ household_head: "Dela Cruz, Ramon", people: 4, hurt: 2, missing: 1, needs: ["water", "food"] }),
    readBattery: async () => readings.shift() ?? { percent: null, charging: null },
    // Every call to the clock moves it one second, so each timed call takes 1 second.
    clock: () => (t += 1000),
    ...overrides,
  };
}

async function writeSet() {
  await writeFile(join(dir, "labels.csv"), LABELS);
  await writeFile(join(dir, "voice.csv"), VOICE);
  for (const name of ["p1", "p2", "p3", "p4", "p6"]) await writeFile(join(dir, "photos", `${name}.jpg`), name);
  for (const name of ["tl1", "ceb1"]) await writeFile(join(dir, "voice", `${name}.wav`), name);
}

describe("runEval", () => {
  it("scores the photos and counts what it skipped and why", async () => {
    await writeSet();
    const results = await runEval({ dir, model: "stub-model", deps: deps(), now: () => new Date("2026-10-09T10:00:00Z") });

    expect(results).toMatchObject({
      generated_by: "pnpm eval",
      generated_at: "2026-10-09T10:00:00.000Z",
      model: "stub-model",
    });
    expect(results.warning).toMatch(/Never edit/);
    expect(results.counts.photos).toEqual({ listed: 6, run: 5, file_missing: 1, call_failed: 1, labeled_by_both: 4, agreed: 3, scored: 3 });
    expect(results.skipped.filter((item) => item.kind === "photo")).toEqual([
      { kind: "photo", file: "photos/p3.jpg", reason: "labelers_disagree", ran: true },
      { kind: "photo", file: "photos/p4.jpg", reason: "label_b_missing", ran: true },
      { kind: "photo", file: "photos/p5.jpg", reason: "file_missing", ran: false },
    ]);

    // p1 right, p2 wrong, p6 failed JSON and counts as unclear, like the app does.
    expect(results.photos.agreement).toMatchObject({ n: 4, agreed: 3, rate: 0.75 });
    expect(results.photos.agreement.kappa).toBeCloseTo(0.6, 10);
    expect(results.photos.accuracy).toEqual({ n: 3, correct: 1, rate: 1 / 3 });
    expect(results.photos.confusion_matrix).toEqual({
      none: { none: 0, partial: 0, total: 0, unclear: 0 },
      partial: { none: 0, partial: 1, total: 0, unclear: 0 },
      total: { none: 0, partial: 1, total: 0, unclear: 1 },
    });
    expect(results.photos.items.map((item) => [item.file, item.expected, item.got, item.seconds, item.error])).toEqual([
      ["photos/p1.jpg", "partial", "partial", 1, null],
      ["photos/p2.jpg", "total", "partial", 1, null],
      ["photos/p3.jpg", null, "none", 1, null],
      ["photos/p4.jpg", null, "total", 1, null],
      ["photos/p6.jpg", "total", "unclear", 1, "invalid_output"],
    ]);
    expect(results.photos.seconds).toEqual({ n: 5, mean: 1, median: 1 });
  });

  it("scores the voice notes per language and skips what it cannot run", async () => {
    await writeSet();
    const { voice, counts, skipped } = await runEval({ dir, model: "stub-model", deps: deps() });

    expect(counts.voice).toEqual({ listed: 4, run: 2, file_missing: 1, call_failed: 0, scored: 2 });
    expect(skipped.filter((item) => item.kind === "voice").map((item) => [item.file, item.reason])).toEqual([
      ["voice/mixed1.wav", "file_missing"],
      ["voice/xx1.wav", "language_unknown"],
    ]);
    expect(voice.languages.tl).toMatchObject({ notes: 1, field_accuracy: 1, all_right_rate: 1 });
    // Name matches in a different order; people and needs are wrong.
    expect(voice.languages.ceb).toMatchObject({ notes: 1, fields_scored: 5, fields_right: 3, field_accuracy: 0.6, all_right_rate: 0 });
    expect(voice.languages.ceb.by_field.household_head).toEqual({ scored: 1, right: 1, rate: 1 });
    expect(voice.languages.mixed).toMatchObject({ notes: 0, field_accuracy: null });
    expect(voice.seconds).toEqual({ n: 2, mean: 1, median: 1 });
    expect(voice.items[1].got?.what_happened).toBeNull();
  });

  it("scales the battery drop to 100 houses", async () => {
    await writeSet();
    const { battery } = await runEval({ dir, model: "stub-model", deps: deps() });
    // 2% over 5 photos run.
    expect(battery).toMatchObject({ houses: 5, percent_per_100_houses: 40, houses_per_full_charge: 250, reason: null });
  });

  it("leaves the battery null when the hub is plugged in", async () => {
    await writeSet();
    const { battery } = await runEval({ dir, model: "stub-model", deps: deps({ readBattery: async () => ({ percent: 90, charging: true }) }) });
    expect(battery).toMatchObject({ percent_per_100_houses: null, houses_per_full_charge: null });
  });

  it("with no second labels and no audio, skips them and fakes nothing", async () => {
    await writeFile(join(dir, "labels.csv"), "file,label_a,label_b,notes\nphotos/p1.jpg,partial,,\nphotos/p2.jpg,total,,\n");
    await writeFile(join(dir, "voice.csv"), VOICE);
    for (const name of ["p1", "p2"]) await writeFile(join(dir, "photos", `${name}.jpg`), name);
    const results = await runEval({ dir, model: "stub-model", deps: deps() });

    expect(results.counts.photos).toMatchObject({ run: 2, labeled_by_both: 0, scored: 0 });
    expect(results.photos.agreement).toEqual({ n: 0, agreed: 0, rate: null, kappa: null });
    expect(results.photos.accuracy).toEqual({ n: 0, correct: 0, rate: null });
    expect(results.skipped.filter((item) => item.reason === "label_b_missing")).toHaveLength(2);
    expect(results.counts.voice).toMatchObject({ run: 0, file_missing: 3 });
    expect(results.voice.seconds).toEqual({ n: 0, mean: null, median: null });
  });

  it("stops without a result when Ollama cannot be reached", async () => {
    await writeSet();
    const down = deps({
      draftPhoto: async () => {
        throw new OllamaError("unavailable", "connection refused");
      },
      readVoice: async () => {
        throw new OllamaError("unavailable", "connection refused");
      },
    });
    await expect(runEval({ dir, model: "stub-model", deps: down })).rejects.toThrow(/could not be reached/);
  });

  it("round-trips through JSON", async () => {
    await writeSet();
    const results = await runEval({ dir, model: "stub-model", deps: deps() });
    expect(JSON.parse(JSON.stringify(results))).toEqual(results);
    await writeFile(join(dir, "results.json"), JSON.stringify(results));
    expect(JSON.parse(await readFile(join(dir, "results.json"), "utf8")).generated_by).toBe("pnpm eval");
  });
});

describe("scripts/eval.ts", () => {
  it("refuses to run with MOCK_AI=1", async () => {
    const run = promisify(execFile)("node_modules/.bin/tsx", ["scripts/eval.ts"], { env: { ...process.env, MOCK_AI: "1" } });
    await expect(run).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("MOCK_AI=1") });
  }, 30_000);
});
