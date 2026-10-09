import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// scripts/check-eval.mjs must agree with src/lib/eval/run.ts: a row it passes
// is a row pnpm eval scores, and a row pnpm eval drops is a problem here.

const script = resolve(__dirname, "../../scripts/check-eval.mjs");
const dirs: string[] = [];

const VOICE_HEADER = "file,language,household_head,people,hurt,missing,what_happened,needs";

function run(files: { labels?: string; voice?: string }) {
  const cwd = mkdtempSync(join(tmpdir(), "check-eval-"));
  dirs.push(cwd);
  mkdirSync(join(cwd, "eval", "photos"), { recursive: true });
  writeFileSync(join(cwd, "eval", "photos", "a.jpg"), "");
  writeFileSync(join(cwd, "eval", "SOURCES.md"), "| file | url | author | license |\n| --- | --- | --- | --- |\n| photos/a.jpg | u | a | CC0 |\n");
  writeFileSync(join(cwd, "eval", "labels.csv"), files.labels ?? "file,label_a,label_b\nphotos/a.jpg,total,total\n");
  writeFileSync(join(cwd, "eval", "voice.csv"), files.voice ?? `${VOICE_HEADER}\n`);
  const result = spawnSync("node", [script], { cwd, encoding: "utf8" });
  return { status: result.status, out: result.stdout + result.stderr };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("check-eval matches run.ts", () => {
  it("rejects a language that is not lower case, as run.ts does", () => {
    const { out } = run({ voice: `${VOICE_HEADER}\nvoice/a.m4a,EN,Ana,4,0,0,,\nvoice/b.m4a,Tl,Ana,4,0,0,,\nvoice/c.m4a,en,Ana,4,0,0,,\n` });
    expect(out).toContain('voice/a.m4a language "EN"');
    expect(out).toContain('voice/b.m4a language "Tl"');
    expect(out).not.toContain("voice/c.m4a language");
  });

  it("reads labels case-insensitively, as parseLabel does", () => {
    const { out } = run({ labels: "file,label_a,label_b\nphotos/a.jpg,Total, TOTAL \n" });
    expect(out).toContain("Agreement   1 of 1");
    expect(out).not.toContain("labels.csv: photos/a.jpg");
  });

  it("still flags an unknown or blank label", () => {
    const { out } = run({ labels: "file,label_a,label_b\nphotos/a.jpg,Heavy,\n" });
    expect(out).toContain('photos/a.jpg label_a "Heavy" is not total, partial or none');
    expect(out).toContain("photos/a.jpg has no label_b");
  });

  it("accepts blank household_head, people, hurt and missing", () => {
    const { out } = run({ voice: `${VOICE_HEADER}\nvoice/a.m4a,en,,,,,,\n` });
    expect(out).not.toMatch(/voice\.csv: voice\/a\.m4a has no/);
    expect(out).not.toContain("is not a whole number");
  });

  it("still flags a number that is not a whole number", () => {
    const { out } = run({ voice: `${VOICE_HEADER}\nvoice/a.m4a,en,Ana,four,0,0,,\n` });
    expect(out).toContain('people "four" is not a whole number');
  });

  it("names the file and column when a column is missing instead of crashing", () => {
    const { status, out } = run({
      labels: "file,label_a\nphotos/a.jpg,total\n",
      voice: "file,language,people\nvoice/a.m4a,en,4\n",
    });
    expect(out).not.toContain("TypeError");
    expect(out).toContain('labels.csv is missing the "label_b" column');
    expect(out).toContain('voice.csv is missing the "needs" column');
    expect(status).toBe(1);
  });
});
