import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";
import {
  countFamilyReports,
  countReview,
  countReviewQueues,
  getFamilyReport,
  listFamilyReports,
  listResponders,
  parseFilter,
  statusLabel,
  urgentLabel,
} from "./family-reports";

// Runs on its own copy of the simulation seed, never on data/ulat.db.

const dir = mkdtempSync(join(tmpdir(), "ulat-family-reports-"));
let db: Db;

beforeAll(async () => {
  const schemaSql = await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema));
  const path = join(dir, "seed.db");
  const sqlite = new Database(path);
  for (const statement of schemaSql) sqlite.exec(statement);
  sqlite.close();
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { env: { ...process.env, DATABASE_PATH: path }, stdio: "pipe" });
  db = drizzle({ client: new Database(path), schema });
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("family reports list", () => {
  it("lists family and neighbor reports, never desk or merged ones", () => {
    const rows = listFamilyReports(db);
    const sources = db.select({ code: schema.reports.code, source: schema.reports.source, status: schema.reports.status }).from(schema.reports).all();
    const expected = sources.filter((r) => r.source !== "desk" && r.status !== "merged").map((r) => r.code);
    expect(rows.map((r) => r.code).sort()).toEqual(expected.sort());
  });

  it("puts urgent reports first, then the newest", () => {
    const rows = listFamilyReports(db);
    const urgent = rows.map((r) => r.hurt > 0 || r.missing > 0);
    expect(urgent.indexOf(false)).toBeGreaterThan(0);
    expect(urgent.slice(urgent.indexOf(false))).not.toContain(true);
    const calm = rows.filter((r) => r.hurt === 0 && r.missing === 0).map((r) => r.created_at);
    expect(calm).toEqual([...calm].sort().reverse());
  });

  it("finds one report by code, even when a filter would hide it", () => {
    const waiting = listFamilyReports(db, "not_assigned")[0];
    expect(listFamilyReports(db, "problems").map((r) => r.code)).not.toContain(waiting.code);
    expect(getFamilyReport(db, waiting.code)).toEqual(waiting);
  });

  it("does not find desk, merged or unknown codes", () => {
    const hidden = db
      .select({ code: schema.reports.code })
      .from(schema.reports)
      .where(or(eq(schema.reports.source, "desk"), eq(schema.reports.status, "merged")))
      .all();
    for (const { code } of hidden) expect(getFamilyReport(db, code)).toBeUndefined();
    expect(getFamilyReport(db, "ZZZZ")).toBeUndefined();
  });

  it("names the assigned responder", () => {
    const assigned = listFamilyReports(db).filter((r) => r.assigned_to);
    expect(assigned.length).toBeGreaterThan(0);
    for (const row of assigned) expect(row.assigned_name).toBeTruthy();
  });

  it("counts each filter and agrees with the filtered lists", () => {
    const counts = countFamilyReports(db);
    for (const filter of ["all", "not_assigned", "on_the_way", "problems"] as const) {
      expect(listFamilyReports(db, filter)).toHaveLength(counts[filter]);
    }
    expect(counts.all).toBeGreaterThanOrEqual(counts.not_assigned + counts.on_the_way + counts.problems);
    expect(listFamilyReports(db, "problems").every((r) => r.status === "cant_assess")).toBe(true);
  });

  it("counts the review tabs", () => {
    const review = countReview(db);
    expect(review.family_reports).toBe(countFamilyReports(db).all);
    expect(review.second_look).toBeGreaterThanOrEqual(0);
    expect(countReviewQueues(db)).toEqual({ second_look: review.second_look, duplicates: review.duplicates });
  });

  it("offers active responders only", () => {
    const names = listResponders(db).map((r) => r.name);
    expect(names).toContain("Mae Santos");
    expect(names).toEqual([...names].sort());
  });
});

describe("labels", () => {
  it("says why a report could not be assessed", () => {
    expect(statusLabel({ status: "cant_assess", cant_reason: "cant_find" })).toEqual({ label: "Can't find", tone: "warning" });
    expect(statusLabel({ status: "cant_assess", cant_reason: "road_blocked" }).label).toBe("Road blocked");
  });

  it("uses the canvas label for a can't assess status with no reason", () => {
    expect(statusLabel({ status: "cant_assess", cant_reason: null })).toEqual({ label: "Can't find", tone: "warning" });
    expect(statusLabel({ status: "waiting", cant_reason: null })).toEqual({ label: "Waiting", tone: "muted-soft" });
    expect(statusLabel({ status: "on_the_way", cant_reason: null }).label).toBe("On the way");
  });

  it("names who is hurt or missing", () => {
    expect(urgentLabel({ hurt: 2, missing: 0 })).toBe("2 hurt");
    expect(urgentLabel({ hurt: 0, missing: 1 })).toBe("1 missing");
    expect(urgentLabel({ hurt: 1, missing: 1 })).toBe("1 hurt, 1 missing");
    expect(urgentLabel({ hurt: 0, missing: 0 })).toBeNull();
  });

  it("reads the filter from the query string", () => {
    expect(parseFilter("problems")).toBe("problems");
    expect(parseFilter("nope")).toBe("all");
    expect(parseFilter(undefined)).toBe("all");
    expect(parseFilter(["problems"])).toBe("all");
  });
});
