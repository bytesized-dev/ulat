import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getTableName, sql } from "drizzle-orm";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { beforeAll, describe, expect, it } from "vitest";

// A real SQLite file in a temp folder, so the transaction and the foreign keys
// are the ones the hub runs with. src/db/path.ts reads DATABASE_PATH when it is
// first imported, so the modules below load after it is set.
const dir = mkdtempSync(join(tmpdir(), "ulat-clear-"));
process.env.DATABASE_PATH = join(dir, "ulat.db");

type Modules = {
  db: typeof import("@/db/client").db;
  schema: typeof import("@/db/schema");
  uploadsPath: string;
  clearData: typeof import("./clear").clearData;
  isSimulation: typeof import("@/lib/auth/settings").isSimulation;
  setSimulation: typeof import("@/lib/auth/settings").setSimulation;
};
let m: Modules;

beforeAll(async () => {
  const schema = await import("@/db/schema");
  const { db } = await import("@/db/client");
  const { uploadsPath } = await import("@/db/path");
  const { clearData } = await import("./clear");
  const { isSimulation, setSimulation } = await import("@/lib/auth/settings");
  m = { db, schema, uploadsPath, clearData, isSimulation, setSimulation };

  // The same schema pnpm db:push writes.
  const statements = await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema));
  for (const statement of statements) db.run(sql.raw(statement));
});

const at = "2026-06-12T06:00:00.000Z";

/** One row in every table, wired together the way the app does it. */
function seed() {
  const { db, schema, uploadsPath } = m;
  const responder = db.insert(schema.responders).values({ name: "Mae Santos", team: "A" }).returning().get();
  db.insert(schema.settings).values([
    { key: "town", value: "Test town" },
    { key: "simulation", value: "true" },
  ]).onConflictDoUpdate({ target: schema.settings.key, set: { value: "x" } }).run();

  const parent = db
    .insert(schema.reports)
    .values({ code: "A2S3", source: "family", household_head: "Dela Cruz", barangay: "Potol (Pob.)", created_at: at, updated_at: at })
    .returning()
    .get();
  const merged = db
    .insert(schema.reports)
    .values({ code: "B3N6", source: "neighbor", household_head: "Dela Cruz", barangay: "Potol (Pob.)", status: "merged", merged_into: parent.id, assigned_to: responder.id, created_at: at, updated_at: at })
    .returning()
    .get();
  const entry = db
    .insert(schema.entries)
    .values({ number: 231, report_id: parent.id, responder_id: responder.id, barangay: "Potol (Pob.)", created_at: at })
    .returning()
    .get();

  mkdirSync(join(uploadsPath, "2026-06-12"), { recursive: true });
  const photoFile = join(uploadsPath, "2026-06-12", "a.jpg");
  const voiceFile = join(uploadsPath, "2026-06-12", "b.webm");
  writeFileSync(photoFile, "photo");
  writeFileSync(voiceFile, "voice");
  db.insert(schema.photos).values([
    { entry_id: entry.id, path: photoFile },
    { report_id: merged.id, path: voiceFile },
  ]).run();

  const place = db.insert(schema.places).values({ type: "relief", name: "Covered court", lat: 10.3, lng: 123.9, created_at: at }).returning().get();
  db.insert(schema.updates).values({ type: "notice", headline: "Water", message: "At the court", place_id: place.id, posted_at: at }).run();
  db.insert(schema.safe_checkins).values({ name: "Ana", barangay: "Potol (Pob.)", staying_at: "Relatives", source: "phone", at }).run();
  db.insert(schema.sitreps).values({ number: 1, created_at: at, snapshot: {} as never, sms: "SITREP 1" }).run();
  db.insert(schema.duplicates).values({ a_type: "report", a_id: parent.id, b_type: "report", b_id: merged.id }).run();
  db.insert(schema.events).values([
    { entity: "report", entity_id: parent.id, type: "created", actor: "family", at },
    { entity: "entry", entity_id: entry.id, type: "confirmed", actor: "Mae Santos", at },
    { entity: "place", entity_id: place.id, type: "saved", actor: "staff", at },
  ]).run();
}

function counts() {
  const { db, schema } = m;
  const tables = [
    schema.settings, schema.responders, schema.reports, schema.entries, schema.photos, schema.events,
    schema.places, schema.updates, schema.safe_checkins, schema.duplicates, schema.sitreps,
  ];
  return Object.fromEntries(
    tables.map((table) => [getTableName(table), db.select().from(table).all().length]),
  );
}

describe("clearData", () => {
  it("wipes the data tables and keeps settings and responders", () => {
    seed();
    expect(counts()).toEqual({
      settings: 2, responders: 1, reports: 2, entries: 1, photos: 2, events: 3,
      places: 1, updates: 1, safe_checkins: 1, duplicates: 1, sitreps: 1,
    });

    const cleared = m.clearData();

    expect(counts()).toEqual({
      settings: 2, responders: 1, reports: 0, entries: 0, photos: 0, events: 0,
      places: 0, updates: 0, safe_checkins: 0, duplicates: 0, sitreps: 0,
    });
    expect(cleared).toMatchObject({ reports: 2, entries: 1, photos: 2, events: 3, places: 1, updates: 1, safe_checkins: 1, duplicates: 1, sitreps: 1 });
  });

  it("deletes the uploaded files and keeps the uploads folder", () => {
    seed();
    expect(existsSync(join(m.uploadsPath, "2026-06-12", "a.jpg"))).toBe(true);

    m.clearData();

    expect(existsSync(join(m.uploadsPath, "2026-06-12"))).toBe(false);
    expect(existsSync(m.uploadsPath)).toBe(true);
  });

  it("deletes family voice recordings in the voice folder too", () => {
    seed();
    mkdirSync(join(m.uploadsPath, "voice", "2026-06-12"), { recursive: true });
    const recording = join(m.uploadsPath, "voice", "2026-06-12", "7d5c1e2a-3b4f-4a6d-9c8e-0f1a2b3c4d5e.webm");
    writeFileSync(recording, "voice");

    m.clearData();

    expect(existsSync(recording)).toBe(false);
    expect(existsSync(join(m.uploadsPath, "voice"))).toBe(false);
    expect(existsSync(m.uploadsPath)).toBe(true);
  });

  it("deletes family photos in the photo folder too", () => {
    seed();
    mkdirSync(join(m.uploadsPath, "photo", "2026-06-12"), { recursive: true });
    const picture = join(m.uploadsPath, "photo", "2026-06-12", "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d.jpg");
    writeFileSync(picture, "photo");

    m.clearData();

    expect(existsSync(picture)).toBe(false);
    expect(existsSync(join(m.uploadsPath, "photo"))).toBe(false);
    expect(existsSync(m.uploadsPath)).toBe(true);
  });

  it("runs on an empty hub with no uploads folder", () => {
    rmSync(m.uploadsPath, { recursive: true, force: true });
    const responders = counts().responders;
    expect(() => m.clearData()).not.toThrow();
    expect(counts().responders).toBe(responders);
  });
});

describe("simulation flag", () => {
  it("is stored in settings and survives a clear", () => {
    m.setSimulation(false);
    expect(m.isSimulation()).toBe(false);
    m.setSimulation(true);
    expect(m.isSimulation()).toBe(true);
    m.clearData();
    expect(m.isSimulation()).toBe(true);
  });
});
