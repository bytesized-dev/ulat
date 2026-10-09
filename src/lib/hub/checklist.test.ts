import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../db/client";
import { freshDb } from "./test-setup";

// The checklist runs on its own SQLite file with the real schema, never on data/ulat.db.

let db: Db;
let settings: typeof import("../../db/schema").settings;
let checklist: typeof import("./checklist");

beforeAll(async () => {
  const fresh = await freshDb("checklist");
  db = fresh.db;
  settings = fresh.schema.settings;
  checklist = await import("./checklist");
});

beforeEach(() => {
  db.delete(settings).run();
});

const storeRaw = (value: string) =>
  db.insert(settings).values({ key: checklist.CHECKLIST_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
const rawRow = () => db.select().from(settings).all().find((row) => row.key === checklist.CHECKLIST_KEY)?.value;

describe("readChecklist", () => {
  it("starts with all eight items open, in the order of the screen", () => {
    const list = checklist.readChecklist(db);
    expect(list.total).toBe(8);
    expect(list.done).toBe(0);
    expect(list.items.map((item) => item.label)).toEqual([
      "Download the town map",
      "Load the AI model",
      "Get the web certificate",
      "Add responders and PIN",
      "Mark shelters and relief",
      "Run the AI check",
      "Print the join poster",
      "Run a drill",
    ]);
    expect(list.items.every((item) => !item.done)).toBe(true);
  });

  it("reads the ticks that are stored", () => {
    storeRaw(JSON.stringify(["ai_model", "poster"]));
    const list = checklist.readChecklist(db);
    expect(list.done).toBe(2);
    expect(list.items.filter((item) => item.done).map((item) => item.id)).toEqual(["ai_model", "poster"]);
  });

  it("ignores ids that are no longer items", () => {
    storeRaw(JSON.stringify(["ai_model", "removed_item"]));
    expect(checklist.readChecklist(db).done).toBe(1);
  });

  it("reads a row that is not JSON as nothing done", () => {
    storeRaw("not json");
    expect(checklist.readChecklist(db).done).toBe(0);
  });

  it("reads a row of the wrong shape as nothing done", () => {
    storeRaw(JSON.stringify({ ai_model: true }));
    expect(checklist.readChecklist(db).done).toBe(0);
    storeRaw(JSON.stringify([1, 2]));
    expect(checklist.readChecklist(db).done).toBe(0);
  });
});

describe("setChecklistItem", () => {
  it("ticks an item and keeps it on the next read", () => {
    const after = checklist.setChecklistItem(db, "town_map", true);
    expect(after.done).toBe(1);
    expect(checklist.readChecklist(db).items[0]).toMatchObject({ id: "town_map", done: true });
  });

  it("keeps the other ticks and stores them in the order of the screen", () => {
    checklist.setChecklistItem(db, "drill", true);
    checklist.setChecklistItem(db, "town_map", true);
    expect(JSON.parse(rawRow()!)).toEqual(["town_map", "drill"]);
  });

  it("ticking twice is the same as ticking once", () => {
    checklist.setChecklistItem(db, "ai_check", true);
    expect(checklist.setChecklistItem(db, "ai_check", true).done).toBe(1);
  });

  it("unticks an item and leaves the rest", () => {
    checklist.setChecklistItem(db, "town_map", true);
    checklist.setChecklistItem(db, "poster", true);
    const after = checklist.setChecklistItem(db, "town_map", false);
    expect(after.items.filter((item) => item.done).map((item) => item.id)).toEqual(["poster"]);
  });

  it("replaces a row that was broken", () => {
    storeRaw("not json");
    checklist.setChecklistItem(db, "responders", true);
    expect(JSON.parse(rawRow()!)).toEqual(["responders"]);
  });

  it("writes one settings row", () => {
    checklist.setChecklistItem(db, "town_map", true);
    checklist.setChecklistItem(db, "poster", true);
    expect(db.select().from(settings).all()).toHaveLength(1);
  });
});

describe("ChecklistItemIdSchema", () => {
  it("accepts the eight ids and nothing else", () => {
    for (const item of checklist.CHECKLIST_ITEMS) expect(checklist.ChecklistItemIdSchema.safeParse(item.id).success).toBe(true);
    for (const bad of ["", "simulation", "__proto__", 3, null, undefined]) {
      expect(checklist.ChecklistItemIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});
