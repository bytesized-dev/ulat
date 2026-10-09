import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";
import { entries, reports, responders, settings } from "../../db/schema";
import { getHubSummary } from "./summary";

// The summary runs on its own in-memory SQLite, never on data/ulat.db. The
// schema comes from src/db/schema.ts through drizzle-kit, the same as pnpm db:push.

let schemaSql: string[];

/** A SQLite handle with the schema in place. */
function create(path: string) {
  const sqlite = new Database(path);
  for (const statement of schemaSql) sqlite.exec(statement);
  return sqlite;
}

beforeAll(async () => {
  schemaSql = await generateSQLiteMigration(
    await generateSQLiteDrizzleJson({}),
    await generateSQLiteDrizzleJson(schema),
  );
});

describe("priority rule", () => {
  let db: Db;
  let responderId: string;
  let number = 0;
  const at = "2026-10-09T06:00:00.000Z";

  type House = Partial<typeof entries.$inferInsert> & { barangay: string };

  function house(h: House) {
    db.insert(entries)
      .values({ number: ++number, responder_id: responderId, status: "confirmed", damage_class: "partial", created_at: at, ...h })
      .run();
  }

  function report(barangay: string, status: (typeof reports.$inferInsert)["status"], hurt = 0) {
    db.insert(reports)
      .values({ code: `T${++number}`, source: "family", household_head: "Test household", barangay, hurt, status, created_at: at, updated_at: at })
      .run();
  }

  const row = (barangay: string) => getHubSummary(db).barangays.find((r) => r.barangay === barangay);
  const order = () => getHubSummary(db).barangays.map((r) => r.barangay);

  beforeEach(() => {
    db = drizzle({ client: create(":memory:"), schema });
    responderId = db.insert(responders).values({ name: "Test responder" }).returning().get().id;
  });

  it("is high when hurt plus missing is 2 or more", () => {
    house({ barangay: "A", hurt: 2 });
    house({ barangay: "B", hurt: 1, missing: 1 });
    house({ barangay: "C", hurt: 1 });
    house({ barangay: "C", hurt: 1 });
    expect([row("A")?.priority, row("B")?.priority, row("C")?.priority]).toEqual(["high", "high", "high"]);
  });

  it("is medium when hurt plus missing is 1", () => {
    house({ barangay: "A", hurt: 1 });
    house({ barangay: "B", missing: 1 });
    expect([row("A")?.priority, row("B")?.priority]).toEqual(["medium", "medium"]);
  });

  it("is medium when 2 or more houses are totally damaged and nobody is hurt", () => {
    house({ barangay: "A", damage_class: "total" });
    house({ barangay: "A", damage_class: "total" });
    expect(row("A")?.priority).toBe("medium");
  });

  it("is low otherwise", () => {
    house({ barangay: "A", damage_class: "total" });
    house({ barangay: "A", damage_class: "partial", people: 9 });
    expect(row("A")?.priority).toBe("low");
  });

  it("ignores entries that are not confirmed", () => {
    house({ barangay: "A", hurt: 3, status: "needs_review" });
    house({ barangay: "A", hurt: 3, status: "draft", damage_class: null });
    house({ barangay: "A", damage_class: "none" });
    expect(row("A")).toMatchObject({ hurt: 0, totally: 0, partially: 0, none: 1, priority: "low" });
    expect(getHubSummary(db)).toMatchObject({ houses_checked: 1, hurt: 0, in_review: 1 });
  });

  it("never lets a family report change the totals or the priority", () => {
    house({ barangay: "A" });
    report("A", "waiting", 5);
    const summary = getHubSummary(db);
    expect(summary).toMatchObject({ houses_checked: 1, hurt: 0, not_yet_visited: 1 });
    expect(row("A")).toMatchObject({ hurt: 0, waiting: 1, priority: "low" });
  });

  it("counts waiting, assigned and on the way reports as not yet visited", () => {
    report("A", "waiting");
    report("A", "assigned");
    report("A", "on_the_way");
    report("A", "visited");
    report("A", "cant_assess");
    report("A", "merged");
    expect(getHubSummary(db).not_yet_visited).toBe(3);
    expect(row("A")?.waiting).toBe(3);
  });

  it("sorts by hurt plus missing, then totally damaged, then waiting", () => {
    house({ barangay: "Waiting more" });
    report("Waiting more", "waiting");
    report("Waiting more", "waiting");
    house({ barangay: "Waiting less" });
    report("Waiting less", "waiting");
    house({ barangay: "More totally", damage_class: "total" });
    house({ barangay: "One hurt", hurt: 1 });
    house({ barangay: "Two hurt", hurt: 1, missing: 1, damage_class: "none" });
    expect(order()).toEqual(["Two hurt", "One hurt", "More totally", "Waiting more", "Waiting less"]);
  });

  it("keeps a stable order by name when everything ties", () => {
    house({ barangay: "Rizal" });
    house({ barangay: "Mabini" });
    expect(order()).toEqual(["Mabini", "Rizal"]);
  });

  it("lists every barangay from settings, even with no entries", () => {
    db.insert(settings).values({ key: "barangays", value: JSON.stringify(["Rizal", "Mabini"]) }).run();
    house({ barangay: "Poblacion", hurt: 1 });
    expect(getHubSummary(db).barangays).toEqual([
      expect.objectContaining({ barangay: "Poblacion", priority: "medium" }),
      { barangay: "Mabini", totally: 0, partially: 0, none: 0, families: 0, people: 0, hurt: 0, missing: 0, waiting: 0, priority: "low" },
      expect.objectContaining({ barangay: "Rizal", priority: "low" }),
    ]);
  });

  it("survives a barangays setting that is not JSON", () => {
    db.insert(settings).values({ key: "barangays", value: "not json" }).run();
    house({ barangay: "Mabini" });
    expect(order()).toEqual(["Mabini"]);
  });

  it("counts each household once per need, and zero for needs nobody listed", () => {
    house({ barangay: "A", needs: ["water", "water", "food"] });
    house({ barangay: "A", needs: ["water"], families: 3 });
    house({ barangay: "A", needs: ["tarp"], status: "needs_review" });
    expect(getHubSummary(db).needs).toEqual({ water: 2, food: 1, tarp: 0, medicine: 0, hygiene_kit: 0, baby_needs: 0 });
  });

  it("returns zeros for an empty hub", () => {
    expect(getHubSummary(db)).toMatchObject({ houses_checked: 0, totally: 0, families: 0, not_yet_visited: 0, barangays: [] });
  });
});
