import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";
import { entries, reports, responders } from "../../db/schema";
import { getLatest, latestText } from "./latest";

// In-memory SQLite with the schema from src/db/schema.ts, like summary.test.ts.

let schemaSql: string[];
let db: Db;
let responderId: string;
let number = 0;

beforeAll(async () => {
  schemaSql = await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema));
});

beforeEach(() => {
  const sqlite = new Database(":memory:");
  for (const statement of schemaSql) sqlite.exec(statement);
  db = drizzle({ client: sqlite, schema });
  responderId = db.insert(responders).values({ name: "Test responder" }).returning().get().id;
});

function entry(e: Partial<typeof entries.$inferInsert>) {
  db.insert(entries)
    .values({ number: ++number, responder_id: responderId, barangay: "Sinonoc", status: "confirmed", damage_class: "partial", created_at: "2026-10-10T14:00:00+08:00", ...e })
    .run();
}

function report(r: Partial<typeof reports.$inferInsert> & { created_at: string }) {
  db.insert(reports)
    .values({ code: `T${++number}`, source: "family", household_head: "Test household", barangay: "Dawo (Pob.)", updated_at: r.created_at, ...r })
    .run();
}

describe("latest activity", () => {
  it("lists confirmations, reviews and new reports, newest first", () => {
    entry({ status: "confirmed", damage_class: "total", household_head: "Garcia household", confirmed_at: "2026-10-10T14:58:00+08:00" });
    report({ barangay: "Dawo (Pob.)", hurt: 2, created_at: "2026-10-10T14:55:00+08:00" });
    entry({ number: 238, status: "needs_review", created_at: "2026-10-10T14:51:00+08:00" });
    entry({ status: "confirmed", damage_class: "partial", household_head: "Dela Cruz household", confirmed_at: "2026-10-10T14:48:00+08:00" });
    entry({ status: "confirmed", damage_class: "none", household_head: "Old household", confirmed_at: "2026-10-10T14:00:00+08:00" });

    expect(getLatest(db).map((i) => [i.time, i.text])).toEqual([
      ["2:58", "Garcia household confirmed"],
      ["2:55", "New report, Dawo (Pob.), 2 hurt"],
      ["2:51", "Entry 0238 needs review"],
      ["2:48", "Dela Cruz household confirmed"],
    ]);
  });

  it("orders by the moment, not the text, when offsets differ", () => {
    report({ barangay: "Earlier", created_at: "2026-10-10T14:50:00+08:00" });
    report({ barangay: "Later", created_at: "2026-10-10T06:55:00Z" });
    expect(getLatest(db).map((i) => i.text)).toEqual(["New report, Later", "New report, Earlier"]);
  });

  it("never shows merged reports", () => {
    report({ status: "merged", created_at: "2026-10-10T14:50:00+08:00" });
    expect(getLatest(db)).toEqual([]);
  });

  it("respects the limit", () => {
    for (let i = 0; i < 6; i++) report({ created_at: `2026-10-10T14:0${i}:00+08:00` });
    expect(getLatest(db, 3)).toHaveLength(3);
  });
});

describe("latest text", () => {
  it("leaves out the hurt count when nobody is hurt", () => {
    expect(latestText({ kind: "report_created", household_head: "X", number: null, barangay: "Sinonoc", hurt: 0 })).toBe("New report, Sinonoc");
  });

  it("names the entry by number when the household is not known", () => {
    expect(latestText({ kind: "entry_confirmed", household_head: null, number: 31, barangay: "Sinonoc", hurt: 0 })).toBe("Entry 0031 confirmed");
  });
});
