import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";
import { entries, events, photos, reports, responders } from "../../db/schema";
import { ENTRIES_PER_PAGE, getEntryDetail, listEntries, parseEntryQuery } from "./entries";

// The queries run on in-memory SQLite with the schema from src/db/schema.ts,
// the same as pnpm db:push, never on data/ulat.db.

let schemaSql: string[];

beforeAll(async () => {
  schemaSql = await generateSQLiteMigration(
    await generateSQLiteDrizzleJson({}),
    await generateSQLiteDrizzleJson(schema),
  );
});

let db: Db;
let mae: string;
let ana: string;
let number = 0;

type House = Partial<typeof entries.$inferInsert>;

/** Confirmed entries get a confirmed_at one minute after the one before, so the order is known. */
function house(h: House = {}) {
  number += 1;
  const at = new Date(Date.UTC(2026, 9, 9, 6, number)).toISOString();
  return db
    .insert(entries)
    .values({
      number,
      responder_id: mae,
      barangay: "Sinonoc",
      household_head: `House ${number}`,
      damage_class: "partial",
      status: "confirmed",
      confirmed_at: at,
      created_at: at,
      ...h,
    })
    .returning()
    .get();
}

beforeEach(() => {
  number = 0;
  const sqlite = new Database(":memory:");
  for (const statement of schemaSql) sqlite.exec(statement);
  db = drizzle({ client: sqlite, schema });
  mae = db.insert(responders).values({ name: "Mae Santos" }).returning().get().id;
  ana = db.insert(responders).values({ name: "Ana Villanueva" }).returning().get().id;
});

describe("listEntries", () => {
  it("lists confirmed entries newest first, with the responder name", () => {
    house({ responder_id: ana });
    house();
    house({ status: "needs_review", confirmed_at: null });
    const page = listEntries(db);
    expect(page.total).toBe(2);
    expect(page.rows.map((r) => [r.number, r.responder])).toEqual([
      [2, "Mae Santos"],
      [1, "Ana Villanueva"],
    ]);
  });

  it("pages ten at a time and counts every match", () => {
    for (let i = 0; i < 23; i++) house();
    const first = listEntries(db);
    expect(first).toMatchObject({ total: 23, page: 1, pages: 3, per_page: ENTRIES_PER_PAGE });
    expect(first.rows).toHaveLength(10);
    expect(first.rows[0]?.number).toBe(23);

    const last = listEntries(db, { page: 3 });
    expect(last.rows.map((r) => r.number)).toEqual([3, 2, 1]);
  });

  it("shows the last page when the page asked for is past the end", () => {
    for (let i = 0; i < 12; i++) house();
    const page = listEntries(db, { page: 9 });
    expect(page.page).toBe(2);
    expect(page.rows).toHaveLength(2);
  });

  it("returns one empty page when nothing matches", () => {
    expect(listEntries(db)).toMatchObject({ rows: [], total: 0, page: 1, pages: 1 });
  });

  it("filters by damage class", () => {
    house({ damage_class: "total" });
    house({ damage_class: "partial" });
    house({ damage_class: "none" });
    house({ damage_class: "total" });
    expect(listEntries(db, { damage_class: "total" }).rows.map((r) => r.number)).toEqual([4, 1]);
    expect(listEntries(db, { damage_class: "partial" }).total).toBe(1);
    expect(listEntries(db, { damage_class: "none" }).total).toBe(1);
  });

  it("filters by barangay", () => {
    house({ barangay: "Sinonoc" });
    house({ barangay: "Dawo (Pob.)" });
    house({ barangay: "Dawo (Pob.)" });
    expect(listEntries(db, { barangay: "Dawo (Pob.)" }).total).toBe(2);
    expect(listEntries(db, { barangay: "Linabo (Pob.)" }).total).toBe(0);
  });

  it("searches household, barangay, purok and the four digit number", () => {
    house({ household_head: "Dela Cruz household", barangay: "Sinonoc", purok: "Purok 3" });
    house({ household_head: "Garcia household", barangay: "Dawo (Pob.)", purok: "Purok 5" });
    house({ number: 231, household_head: "Ramos household", barangay: "Potol (Pob.)" });
    const found = (q: string) => listEntries(db, { q }).rows.map((r) => r.household_head);
    expect(found("cruz")).toEqual(["Dela Cruz household"]);
    expect(found("dawo")).toEqual(["Garcia household"]);
    expect(found("purok 5")).toEqual(["Garcia household"]);
    expect(found("0231")).toEqual(["Ramos household"]);
  });

  it("treats a percent sign in the search as text", () => {
    house({ household_head: "Cruz household" });
    expect(listEntries(db, { q: "%" }).total).toBe(0);
  });

  it("treats an underscore in the search as text", () => {
    house({ household_head: "Cruz household" });
    house({ household_head: "A_B household" });
    expect(listEntries(db, { q: "_" }).rows.map((r) => r.household_head)).toEqual(["A_B household"]);
  });

  it("orders entries confirmed at the same moment by number, newest first, across pages", () => {
    const same = "2026-10-09T07:00:00.000Z";
    for (let i = 0; i < 12; i++) house({ confirmed_at: same });
    expect(listEntries(db, { page: 1 }).rows.map((r) => r.number)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(listEntries(db, { page: 2 }).rows.map((r) => r.number)).toEqual([2, 1]);
  });

  it("combines filters", () => {
    house({ damage_class: "total", barangay: "Sinonoc" });
    house({ damage_class: "total", barangay: "Dawo (Pob.)" });
    house({ damage_class: "partial", barangay: "Dawo (Pob.)" });
    expect(listEntries(db, { damage_class: "total", barangay: "Dawo (Pob.)" }).total).toBe(1);
  });
});

describe("parseEntryQuery", () => {
  it("reads the page and filters", () => {
    expect(parseEntryQuery({ page: "2", damage_class: "total", barangay: "Sinonoc", q: " cruz " })).toEqual({
      page: 2,
      damage_class: "total",
      barangay: "Sinonoc",
      q: "cruz",
    });
  });

  it("drops values that are not valid instead of failing", () => {
    expect(parseEntryQuery({ page: "-4", damage_class: "unclear" })).toEqual({ page: 1 });
    expect(parseEntryQuery({ page: ["3", "4"] }).page).toBe(3);
    expect(parseEntryQuery({})).toEqual({ page: 1 });
  });
});

describe("getEntryDetail", () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 9, 6, minute)).toISOString();

  function event(entryId: string, type: string, actor: string, minute: number, data: Record<string, unknown> = {}) {
    db.insert(events).values({ entity: "entry", entity_id: entryId, type, actor, data, at: at(minute) }).run();
  }

  it("returns null for an unknown id", () => {
    expect(getEntryDetail(db, "missing")).toBeNull();
  });

  it("returns the photos in the order they were taken", () => {
    const e = house();
    db.insert(photos).values({ entry_id: e.id, path: "b.jpg", label: "Roof", taken_at: at(2) }).run();
    db.insert(photos).values({ entry_id: e.id, path: "a.jpg", label: "Front", taken_at: at(1) }).run();
    const other = house();
    db.insert(photos).values({ entry_id: other.id, path: "c.jpg", label: "Back wall", taken_at: at(3) }).run();
    expect(getEntryDetail(db, e.id)?.photos.map((p) => p.label)).toEqual(["Front", "Roof"]);
  });

  it("keeps photos in the order they were saved when taken at the same moment", () => {
    const e = house();
    for (const label of ["Front", "Roof", "Back wall"]) {
      db.insert(photos).values({ entry_id: e.id, path: `${label}.jpg`, label, taken_at: at(1) }).run();
    }
    expect(getEntryDetail(db, e.id)?.photos.map((p) => p.label)).toEqual(["Front", "Roof", "Back wall"]);
  });

  it("names the responder and links the family report", () => {
    const report = db
      .insert(reports)
      .values({
        code: "K7P4",
        source: "family",
        household_head: "Dela Cruz household",
        reporter_name: "Rosa Dela Cruz",
        barangay: "Sinonoc",
        people: 5,
        hurt: 1,
        status: "visited",
        created_at: at(0),
        updated_at: at(0),
      })
      .returning()
      .get();
    const match = house({ report_id: report.id, people: 5, hurt: 1 });
    const differs = house({ report_id: report.id, people: 6, hurt: 1 });
    expect(getEntryDetail(db, match.id)).toMatchObject({
      responder: "Mae Santos",
      report: { code: "K7P4", reporter_name: "Rosa Dela Cruz", counts_match: true },
    });
    expect(getEntryDetail(db, differs.id)?.report?.counts_match).toBe(false);
    expect(getEntryDetail(db, house().id)?.report).toBeNull();
  });

  it("builds the history from the report and the events, oldest first", () => {
    const report = db
      .insert(reports)
      .values({ code: "K7P4", source: "family", household_head: "Dela Cruz", barangay: "Sinonoc", status: "visited", created_at: at(0), updated_at: at(0) })
      .returning()
      .get();
    const e = house({ report_id: report.id });
    event(e.id, "entry.confirmed", mae, 8);
    event(e.id, "ai.photo", "system", 6);
    event(e.id, "entry.created", mae, 4, { number: e.number });
    event(e.id, "entry.field_changed", mae, 7, { field: "hurt", from: 0, to: 1 });
    // Another entry's events, non-entry events and AI events stay out.
    const other = house();
    event(other.id, "entry.created", ana, 4);
    db.insert(events).values({ entity: "ai", entity_id: e.id, type: "ai.voice", actor: "system", at: at(3) }).run();

    expect(getEntryDetail(db, e.id)!.history).toEqual([
      { label: "Family report", at: at(0) },
      { label: "Taken by Mae", at: at(4) },
      { label: "Changed hurt by Mae", at: at(7) },
      { label: "Confirmed", at: at(8) },
    ]);
  });

  it("never shows a raw actor id in the history", () => {
    const e = house();
    event(e.id, "entry.created", "6c0f7a52-0000-4000-8000-000000000000", 1);
    event(e.id, "entry.photo_added", "system", 2);
    event(e.id, "entry.photo_added", "staff", 3);
    expect(getEntryDetail(db, e.id)!.history.map((h) => h.label)).toEqual([
      "Taken by Responder",
      "Photo added by System",
      "Photo added by Staff",
    ]);
  });

  it("has an empty history when nothing was recorded", () => {
    expect(getEntryDetail(db, house().id)!.history).toEqual([]);
  });

  it("opens an entry that is not confirmed yet", () => {
    const e = house({ status: "needs_review", confirmed_at: null });
    expect(getEntryDetail(db, e.id)?.entry.status).toBe("needs_review");
  });
});
