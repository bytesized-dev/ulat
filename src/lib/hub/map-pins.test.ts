import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { map as mapConfig } from "../../config";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";
import { entries, places, reports, responders, settings } from "../../db/schema";
import { getMapBbox, getMapPins } from "./map-pins";

let schemaSql: string[];
let db: Db;
let responderId: string;
let number = 0;
const at = "2026-10-10T14:00:00+08:00";
const here = { lat: 8.65, lng: 123.42 };

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
  db.insert(entries).values({ number: ++number, responder_id: responderId, barangay: "Sinonoc", created_at: at, ...here, ...e }).run();
}

function report(status: (typeof reports.$inferInsert)["status"], r: Partial<typeof reports.$inferInsert> = {}) {
  db.insert(reports)
    .values({ code: `T${++number}`, source: "family", household_head: "Cruz household", barangay: "Sinonoc", status, created_at: at, updated_at: at, ...here, ...r })
    .run();
}

function place(type: (typeof places.$inferInsert)["type"], visible = true) {
  db.insert(places).values({ type, name: `A ${type}`, visible, created_at: at, ...here }).run();
}

const kinds = () => getMapPins(db).map((p) => p.kind).sort();

describe("map pins", () => {
  it("shows confirmed total and partial entries, never none, drafts or reviews", () => {
    entry({ status: "confirmed", damage_class: "total", household_head: "Garcia household" });
    entry({ status: "confirmed", damage_class: "partial" });
    entry({ status: "confirmed", damage_class: "none" });
    entry({ status: "needs_review", damage_class: "total" });
    entry({ status: "draft" });
    expect(kinds()).toEqual(["partial", "total"]);
    expect(getMapPins(db).find((p) => p.kind === "total")).toMatchObject({ label: "Garcia household, totally damaged", ...here });
  });

  it("names an entry by number when the household is not known", () => {
    entry({ number: 31, status: "confirmed", damage_class: "partial", household_head: null });
    expect(getMapPins(db)[0].label).toBe("Entry 0031, partially damaged");
  });

  it("shows reports nobody has visited yet as unvisited", () => {
    for (const status of ["waiting", "assigned", "on_the_way", "visited", "cant_assess", "merged"] as const) report(status);
    expect(kinds()).toEqual(["unvisited", "unvisited", "unvisited"]);
    expect(getMapPins(db)[0].label).toBe("Cruz household, not visited");
  });

  it("shows visible places by type and hides hidden ones", () => {
    place("relief");
    place("shelter");
    place("hazard");
    place("hazard", false);
    expect(kinds()).toEqual(["hazard", "relief", "shelter"]);
  });

  it("leaves out anything without a position", () => {
    entry({ status: "confirmed", damage_class: "total", lat: null, lng: null });
    report("waiting", { lat: null, lng: null });
    expect(getMapPins(db)).toEqual([]);
  });

  it("gives every pin a unique id", () => {
    entry({ status: "confirmed", damage_class: "total" });
    report("waiting");
    place("relief");
    const ids = getMapPins(db).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("map bbox", () => {
  const { west, south, east, north } = mapConfig.placeholderBbox;

  it("reads the map_bbox setting", () => {
    db.insert(settings).values({ key: "map_bbox", value: JSON.stringify({ west: 123.4, south: 8.6, east: 123.5, north: 8.7 }) }).run();
    expect(getMapBbox(db)).toEqual([123.4, 8.6, 123.5, 8.7]);
  });

  it("falls back to the placeholder when the setting is missing or broken", () => {
    expect(getMapBbox(db)).toEqual([west, south, east, north]);
    db.insert(settings).values({ key: "map_bbox", value: "not json" }).run();
    expect(getMapBbox(db)).toEqual([west, south, east, north]);
  });
});
