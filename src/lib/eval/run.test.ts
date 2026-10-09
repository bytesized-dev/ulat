import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OllamaError } from "@/lib/ai/ollama";
import type { AiPhotoDraft, AiVoiceExtract } from "@/lib/contracts";
import { MAX_UNAVAILABLE_IN_A_ROW, parseRepeat, runEval, type EvalDeps } from "./run";

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
    expect(results.counts.photos).toEqual({ listed: 6, run: 5, calls: 5, file_missing: 1, call_failed: 1, labeled_by_both: 4, agreed: 3, scored: 3 });
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

const down = () => new OllamaError("unavailable", "connection refused");

describe("runEval when Ollama drops", () => {
  // p1..p4 and p6 are the five photos on disk, called in that order.
  const nth = (plan: ("ok" | "down" | "timeout")[]) => {
    let call = 0;
    return async () => {
      const step = plan[call++];
      if (step === "down") throw down();
      if (step === "timeout") throw new OllamaError("timeout", "no reply in 60 seconds");
      return draft("partial");
    };
  };

  it("keeps unavailable photos out of timing and houses and lists them as skipped", async () => {
    await writeSet();
    const results = await runEval({ dir, model: "stub-model", deps: deps({ draftPhoto: nth(["ok", "down", "ok", "down", "ok"]) }) });

    expect(results.counts.photos).toMatchObject({ listed: 6, run: 3, calls: 3, call_failed: 0 });
    expect(results.photos.items.map((item) => item.file)).toEqual(["photos/p1.jpg", "photos/p3.jpg", "photos/p6.jpg"]);
    expect(results.photos.seconds).toEqual({ n: 3, mean: 1, median: 1 });
    // 2% over the 3 real calls, not the 5 that were tried.
    expect(results.battery).toMatchObject({ houses: 3, percent_per_100_houses: (2 / 3) * 100 });
    expect(results.skipped.filter((item) => item.reason === "unavailable")).toEqual([
      { kind: "photo", file: "photos/p2.jpg", reason: "unavailable", ran: false },
      { kind: "photo", file: "photos/p4.jpg", reason: "unavailable", ran: false },
    ]);
    // An unavailable photo gets no second reason.
    expect(results.skipped.filter((item) => item.file === "photos/p4.jpg")).toHaveLength(1);
  });

  it("still counts both labelers on a photo whose call was unavailable", async () => {
    await writeSet();
    const results = await runEval({ dir, model: "stub-model", deps: deps({ draftPhoto: nth(["ok", "down", "ok", "ok", "ok"]) }) });
    expect(results.counts.photos).toMatchObject({ labeled_by_both: 4, agreed: 3, scored: 2 });
  });

  it("counts a timeout and invalid output as real attempts", async () => {
    await writeSet();
    const results = await runEval({ dir, model: "stub-model", deps: deps({ draftPhoto: nth(["timeout", "ok", "ok", "ok", "ok"]) }) });

    expect(results.counts.photos).toMatchObject({ run: 5, calls: 5, call_failed: 1 });
    expect(results.photos.items[0]).toMatchObject({ got: "unclear", error: "timeout", seconds: 1 });
    expect(results.photos.seconds.n).toBe(5);
    expect(results.battery.houses).toBe(5);
    expect(results.skipped.some((item) => item.reason === "unavailable")).toBe(false);
  });

  it("stops after 3 unavailable calls in a row", async () => {
    await writeSet();
    let calls = 0;
    const draftPhoto = async () => {
      calls++;
      throw down();
    };
    await expect(runEval({ dir, model: "stub-model", deps: deps({ draftPhoto }) })).rejects.toThrow(
      `Ollama could not be reached for ${MAX_UNAVAILABLE_IN_A_ROW} calls in a row, so the run stopped and nothing was written.`,
    );
    expect(calls).toBe(MAX_UNAVAILABLE_IN_A_ROW);
  });

  it("does not stop when a call gets through between the failures", async () => {
    await writeSet();
    const results = await runEval({ dir, model: "stub-model", deps: deps({ draftPhoto: nth(["down", "down", "ok", "down", "down"]) }) });
    expect(results.skipped.filter((item) => item.reason === "unavailable")).toHaveLength(4);
    expect(results.counts.photos.run).toBe(1);
  });

  it("counts the run of failures across photos and voice notes", async () => {
    await writeSet();
    // The last two photos and the first voice note.
    const draftPhoto = nth(["ok", "ok", "ok", "down", "down"]);
    const readVoice = async () => {
      throw down();
    };
    await expect(runEval({ dir, model: "stub-model", deps: deps({ draftPhoto, readVoice }) })).rejects.toThrow(/3 calls in a row/);
  });

  it("lists an unavailable voice note as skipped, with no row and no timing", async () => {
    await writeSet();
    let call = 0;
    const readVoice = async () => {
      if (call++ === 0) throw down();
      return note({ household_head: "Ramon Dela Cruz", people: 5, hurt: 2, missing: 1, needs: ["water", "food", "tarp"] });
    };
    const { voice, counts, skipped } = await runEval({ dir, model: "stub-model", deps: deps({ readVoice }) });

    expect(counts.voice).toMatchObject({ run: 1, call_failed: 0, scored: 1 });
    expect(voice.items.map((item) => item.file)).toEqual(["voice/ceb1.wav"]);
    expect(voice.seconds.n).toBe(1);
    expect(skipped).toContainEqual({ kind: "voice", file: "voice/tl1.wav", reason: "unavailable", ran: false });
  });
});

describe("runEval with repeat", () => {
  // Answers right for the first pass of five, then wrong, so any repeat that
  // leaked into the scores would show.
  const driftingDeps = (overrides: Partial<EvalDeps> = {}) => {
    let calls = 0;
    const draftPhoto = vi.fn(async ({ photos }: { photos: { data: Buffer }[] }) => {
      calls++;
      if (calls > 5) return draft("none");
      const name = photos[0].data.toString();
      if (name === "p6") throw new OllamaError("invalid_output", "not JSON", "oops");
      return draft(({ p1: "partial", p2: "partial", p3: "none", p4: "total" } as const)[name as "p1"] ?? "unclear");
    });
    return { ...deps({ draftPhoto, ...overrides }), draftPhoto };
  };

  it("loops the photo set until the calls are done and uses the total for the battery", async () => {
    await writeSet();
    const d = driftingDeps();
    const results = await runEval({ dir, model: "stub-model", deps: d, repeat: 12 });

    expect(d.draftPhoto).toHaveBeenCalledTimes(12);
    expect(results.counts.photos).toMatchObject({ run: 5, calls: 12, scored: 3 });
    expect(results.photos.seconds).toEqual({ n: 12, mean: 1, median: 1 });
    // 2% over 12 houses.
    expect(results.battery).toMatchObject({ houses: 12, percent_per_100_houses: (2 / 12) * 100, houses_per_full_charge: 600 });
  });

  it("scores only the first pass", async () => {
    await writeSet();
    const once = await runEval({ dir, model: "stub-model", deps: driftingDeps() });
    const repeated = await runEval({ dir, model: "stub-model", deps: driftingDeps(), repeat: 50 });

    expect(repeated.photos.accuracy).toEqual(once.photos.accuracy);
    expect(repeated.photos.confusion_matrix).toEqual(once.photos.confusion_matrix);
    expect(repeated.photos.agreement).toEqual(once.photos.agreement);
    expect(repeated.photos.items).toEqual(once.photos.items);
    expect(repeated.skipped).toEqual(once.skipped);
    expect(repeated.counts.photos).toMatchObject({ run: 5, scored: 3 });
  });

  it("always runs the whole set once, even when repeat is smaller", async () => {
    await writeSet();
    const d = driftingDeps();
    const results = await runEval({ dir, model: "stub-model", deps: d, repeat: 3 });
    expect(d.draftPhoto).toHaveBeenCalledTimes(5);
    expect(results.battery.houses).toBe(5);
  });

  it("does not count unavailable calls in a repeat pass as houses, and stops after 3 in a row", async () => {
    await writeSet();
    let calls = 0;
    const draftPhoto = async () => {
      calls++;
      if (calls === 7) throw down();
      if (calls > 9) throw down();
      return draft("partial");
    };
    // Call 7 fails alone, then 10, 11 and 12 fail in a row.
    await expect(runEval({ dir, model: "stub-model", deps: deps({ draftPhoto }), repeat: 20 })).rejects.toThrow(/3 calls in a row/);
    expect(calls).toBe(12);
  });

  it("keeps the houses honest when a repeat pass loses a call", async () => {
    await writeSet();
    let calls = 0;
    const draftPhoto = async () => {
      if (++calls === 7) throw down();
      return draft("partial");
    };
    const results = await runEval({ dir, model: "stub-model", deps: deps({ draftPhoto }), repeat: 10 });
    expect(results.counts.photos).toMatchObject({ run: 5, calls: 10 });
    expect(results.battery.houses).toBe(10);
    expect(results.skipped.filter((item) => item.reason === "unavailable")).toEqual([
      { kind: "photo", file: "photos/p2.jpg", reason: "unavailable", ran: false },
    ]);
  });

  it("does not loop when no photo file is there", async () => {
    await writeFile(join(dir, "labels.csv"), LABELS);
    await writeFile(join(dir, "voice.csv"), "file,language,household_head,people,hurt,missing,what_happened,needs\n");
    const d = driftingDeps();
    const results = await runEval({ dir, model: "stub-model", deps: d, repeat: 100 });
    expect(d.draftPhoto).not.toHaveBeenCalled();
    expect(results.counts.photos).toMatchObject({ run: 0, calls: 0, file_missing: 6 });
  });
});

describe("parseRepeat", () => {
  it("reads --repeat N, --repeat=N and EVAL_REPEAT, with the flag winning", () => {
    expect(parseRepeat(["--repeat", "100"], {})).toBe(100);
    expect(parseRepeat(["--repeat=40"], {})).toBe(40);
    expect(parseRepeat([], { EVAL_REPEAT: "25" })).toBe(25);
    expect(parseRepeat(["--repeat", "10"], { EVAL_REPEAT: "25" })).toBe(10);
    expect(parseRepeat([], {})).toBeUndefined();
    expect(parseRepeat([], { EVAL_REPEAT: "" })).toBeUndefined();
  });

  it("rejects anything that is not a whole number of at least 1", () => {
    for (const bad of ["0", "-3", "2.5", "many"]) {
      expect(() => parseRepeat(["--repeat", bad], {})).toThrow(/whole number of at least 1/);
    }
    expect(() => parseRepeat([], { EVAL_REPEAT: "x" })).toThrow(/EVAL_REPEAT must be a whole number/);
    expect(() => parseRepeat(["--repeat"], {})).toThrow(/needs a number/);
  });
});

describe("runEval voice rows", () => {
  it("keeps the transcript and the English in each row, and does not score them", async () => {
    await writeSet();
    const readVoice = async ({ audio }: { audio: Buffer }) =>
      note({
        household_head: "Liza Santos",
        people: 6,
        hurt: 1,
        missing: 2,
        needs: ["water", "medicine"],
        transcript: `Ako si Liza Santos (${audio.toString()})`,
        english: "I am Liza Santos.",
      });
    const { voice } = await runEval({ dir, model: "stub-model", deps: deps({ readVoice }) });

    expect(voice.items[0].got).toMatchObject({ transcript: "Ako si Liza Santos (tl1)", english: "I am Liza Santos." });
    expect(voice.items[1].got).toMatchObject({ transcript: "Ako si Liza Santos (ceb1)", english: "I am Liza Santos." });
    // Fields scored are still the same five.
    expect(voice.items[0].fields).toEqual({ household_head: true, people: true, hurt: true, missing: true, needs: true });
    expect(Object.keys(voice.languages.tl.by_field)).not.toContain("transcript");
  });
});

describe("scripts/eval.ts", () => {
  it("refuses to run with MOCK_AI=1", async () => {
    const run = promisify(execFile)("node_modules/.bin/tsx", ["scripts/eval.ts"], { env: { ...process.env, MOCK_AI: "1" } });
    await expect(run).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("MOCK_AI=1") });
  }, 30_000);
});
