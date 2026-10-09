import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../../src/db/client";
import * as schema from "../../src/db/schema";
import { AiPhotoDraft } from "../../src/lib/contracts";
import { detectDuplicates, listOpenDuplicates } from "../../src/lib/hub/duplicates";
import { getEntryDetail } from "../../src/lib/hub/entries";

// The demo seed on its own SQLite file, never data/ulat.db. It runs
// scripts/seed.ts, the same path as pnpm db:seed, with the time shift on.
// tests/setup.ts turns the shift off for every other test.

const dir = mkdtempSync(join(tmpdir(), "ulat-seed-demo-"));
const MINUTE = 60_000;

function seeded(name: string, env: Record<string, string>, statements: string[]) {
  const path = join(dir, name);
  const sqlite = new Database(path);
  for (const statement of statements) sqlite.exec(statement);
  sqlite.close();
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { env: { ...process.env, DATABASE_PATH: path, ...env }, stdio: "pipe" });
  return drizzle({ client: new Database(path), schema }) as unknown as Db;
}

const newest = (db: Db) => {
  const times = [
    ...db.select({ at: schema.reports.created_at }).from(schema.reports).all().map((r) => r.at),
    ...db.select({ at: schema.entries.created_at }).from(schema.entries).all().map((r) => r.at),
    ...db.select({ at: schema.updates.posted_at }).from(schema.updates).all().map((r) => r.at),
    ...db.select({ at: schema.safe_checkins.at }).from(schema.safe_checkins).all().map((r) => r.at),
    ...db.select({ at: schema.events.at }).from(schema.events).all().map((r) => r.at),
  ];
  return Math.max(...times.map((t) => Date.parse(t)));
};

let shifted: Db;
let before: number;
let after: number;

beforeAll(async () => {
  const statements = await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema));
  before = Date.now();
  shifted = seeded("shifted.db", { SEED_FIXED_TIMES: "0" }, statements);
  after = Date.now();
}, 120_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("seed times", () => {
  it("puts the newest time a few minutes before the load", () => {
    expect(newest(shifted)).toBeLessThan(before - 2 * MINUTE);
    expect(newest(shifted)).toBeGreaterThan(before - 5 * MINUTE);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("keeps the spacing between reports as written in the seed file", () => {
    const written = JSON.parse(readFileSync("seed/simulation.json", "utf8")).reports as { code: string; created_at: string }[];
    const gaps = (rows: { code: string; at: string }[]) => {
      const top = Math.max(...rows.map((r) => Date.parse(r.at)));
      return rows.map((r) => `${r.code}:${(top - Date.parse(r.at)) / MINUTE}`).sort();
    };
    const stored = shifted.select({ code: schema.reports.code, at: schema.reports.created_at }).from(schema.reports).all();
    expect(gaps(stored)).toEqual(gaps(written.map((r) => ({ code: r.code, at: r.created_at }))));
  });
});

describe("seed duplicates", () => {
  it("finds the two pairs on its own, none of them added by the seed", () => {
    expect(shifted.select().from(schema.duplicates).all()).toHaveLength(0);
    expect(detectDuplicates(shifted)).toBe(2);
    const pairs = listOpenDuplicates(shifted).map((p) => [p.a.label, p.b.label, p.mergeable]);
    expect(pairs).toEqual(expect.arrayContaining([["K9D2", "K9F5", true]]));
    expect(pairs).toHaveLength(2);
    expect(detectDuplicates(shifted)).toBe(0);
  });
});

describe("seed history", () => {
  it("gives every entry a trail ending in confirmed or needs review", () => {
    const rows = shifted.select().from(schema.entries).all();
    expect(rows).toHaveLength(49);
    for (const entry of rows) {
      const detail = getEntryDetail(shifted, entry.id);
      const labels = detail?.history.map((h) => h.label) ?? [];
      expect(labels.slice(-3), `entry ${entry.number}`).toEqual([
        expect.stringMatching(/^Taken by /),
        "AI draft",
        entry.status === "confirmed" ? "Confirmed" : expect.stringMatching(/^Sent for review by /),
      ]);
    }
  });

  it("stores the AI draft in the shape the photo route stores", () => {
    const drafts = shifted.select().from(schema.events).all().filter((e) => e.type === "ai.photo");
    expect(drafts).toHaveLength(49);
    for (const e of drafts) expect(AiPhotoDraft.safeParse(JSON.parse(String((e.data as { raw: string }).raw))).success).toBe(true);
  });
});
