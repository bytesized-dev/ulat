import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REVIEW_REASONS } from "@/app/api/entries/_lib/review";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";
import { EntryConfirm } from "../contracts/schemas";
import { confirmEntry } from "./api-client";
import {
  aiSide,
  askForPhotos,
  listReviewEntries,
  listReviewPhotos,
  PHOTOS_REQUESTED,
  reasonLabels,
  reasonTone,
  responderSide,
  reviewActions,
  type ReviewEntry,
} from "./review";

// Runs on its own copy of the simulation seed, never on data/ulat.db.

const dir = mkdtempSync(join(tmpdir(), "ulat-review-"));
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

const byNumber = (n: number) => {
  const entry = listReviewEntries(db).find((e) => e.number === n);
  if (!entry) throw new Error(`seed has no needs_review entry ${n}`);
  return entry;
};

describe("second look list", () => {
  it("lists exactly the needs_review entries, with the responder who sent each", () => {
    const rows = listReviewEntries(db);
    const expected = db.select({ number: schema.entries.number }).from(schema.entries).where(eq(schema.entries.status, "needs_review")).all();
    expect(rows.map((r) => r.number).sort()).toEqual(expected.map((r) => r.number).sort());
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.responder_name.length).toBeGreaterThan(0);
  });

  it("matches the count on the Review tabs", () => {
    const n = db.select({ id: schema.entries.id }).from(schema.entries).where(eq(schema.entries.status, "needs_review")).all().length;
    expect(listReviewEntries(db)).toHaveLength(n);
  });

  it("puts the newest first", () => {
    const times = listReviewEntries(db).map((r) => r.created_at);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("never lists drafts or confirmed entries", () => {
    const listed = new Set(listReviewEntries(db).map((r) => r.id));
    const others = db.select({ id: schema.entries.id, status: schema.entries.status }).from(schema.entries).all().filter((e) => e.status !== "needs_review");
    expect(others.length).toBeGreaterThan(0);
    for (const e of others) expect(listed.has(e.id)).toBe(false);
  });

  it("lists the photos of one entry, none for an entry without any", () => {
    const entry = listReviewEntries(db)[0];
    expect(listReviewPhotos(db, entry.id)).toEqual([]);
    db.insert(schema.photos).values([
      { entry_id: entry.id, path: "a.jpg", label: "Back", taken_at: "2026-09-04T06:52:00Z" },
      { entry_id: entry.id, path: "b.jpg", label: "Front", taken_at: "2026-09-04T06:51:00Z" },
    ]).run();
    expect(listReviewPhotos(db, entry.id).map((p) => p.label)).toEqual(["Front", "Back"]);
  });
});

describe("reason text", () => {
  it("shortens the sentences the entries route stores", () => {
    expect(reasonLabels(REVIEW_REASONS.class_differs)).toEqual(["Responder changed class"]);
    expect(reasonLabels(REVIEW_REASONS.unclear_no_new_photo)).toEqual(["AI not sure"]);
    expect(reasonLabels(REVIEW_REASONS.hurt_differs)).toEqual(["Hurt count differs"]);
  });

  it("gives every reason when the route stored several", () => {
    const stored = `${REVIEW_REASONS.class_differs} ${REVIEW_REASONS.hurt_differs}`;
    expect(reasonLabels(stored)).toEqual(["Responder changed class", "Hurt count differs"]);
  });

  it("shows the short labels the seed stores as they are", () => {
    expect(reasonLabels("AI not sure")).toEqual(["AI not sure"]);
  });

  it("says something when no reason was stored", () => {
    expect(reasonLabels(null)).toEqual(["Needs a second look"]);
    expect(reasonLabels("  ")).toEqual(["Needs a second look"]);
  });

  it("marks a hurt count that differs as the urgent one", () => {
    expect(reasonTone("Hurt count differs")).toBe("danger");
    expect(reasonTone("AI not sure")).toBe("muted-soft");
    expect(reasonTone("Responder changed class")).toBe("warning");
  });

  it("gives every seeded entry a reason the list can show", () => {
    for (const entry of listReviewEntries(db)) expect(reasonLabels(entry.review_reason).length).toBeGreaterThan(0);
  });
});

describe("the two sides", () => {
  it("shows the AI class and its reason", () => {
    expect(aiSide({ ai_class: "partial", ai_reason: "Roof partly missing on the left.", ai_need_more: null })).toEqual({
      label: "Partially damaged",
      tone: "warning",
      text: "Roof partly missing on the left.",
    });
  });

  it("shows what the AI wanted when it was not sure", () => {
    const side = aiSide({ ai_class: "unclear", ai_reason: "The roof is not visible.", ai_need_more: "Roof from the side" });
    expect(side).toMatchObject({ label: "Not sure", tone: "muted-soft", text: "Roof from the side" });
    expect(aiSide({ ai_class: "unclear", ai_reason: "The roof is not visible.", ai_need_more: null }).text).toBe("The roof is not visible.");
  });

  it("says so when the AI never drafted", () => {
    expect(aiSide({ ai_class: null, ai_reason: null, ai_need_more: null }).label).toBe("No AI draft");
  });

  it("shows the responder's class and note", () => {
    expect(responderSide({ damage_class: "total", note: "Back half collapsed.", hurt: 0, report_hurt: null })).toEqual({
      label: "Totally damaged",
      tone: "danger",
      text: "Back half collapsed.",
    });
  });

  it("adds the family report's hurt count only when it differs", () => {
    expect(responderSide({ damage_class: "partial", note: null, hurt: 2, report_hurt: 0 }).text).toBe("Hurt: 2. The family report says 0.");
    expect(responderSide({ damage_class: "partial", note: null, hurt: 2, report_hurt: 2 }).text).toBe("No note.");
  });
});

describe("approve and use the AI class", () => {
  it("approves the responder's class with the responder's values", () => {
    const entry = byNumber(238);
    const { approve } = reviewActions(entry);
    expect(approve?.label).toBe("Approve totally damaged");
    expect(approve?.body).toEqual({ ...entry.confirm, damage_class: "total" });
    expect(EntryConfirm.safeParse(approve?.body).success).toBe(true);
  });

  it("uses the AI class and changes nothing else", () => {
    const entry = byNumber(238);
    const { approve, useAi } = reviewActions(entry);
    expect(useAi?.label).toBe("Use partially");
    expect(useAi?.body).toEqual({ ...approve?.body, damage_class: "partial" });
  });

  it("offers no AI class when the AI was not sure", () => {
    expect(reviewActions(byNumber(239)).useAi).toBeNull();
  });

  it("offers no AI class when the AI already agrees", () => {
    expect(reviewActions(byNumber(241)).useAi).toBeNull();
    expect(reviewActions(byNumber(241)).approve).not.toBeNull();
  });

  it("sends a material the contract accepts when the entry has none", () => {
    const entry: ReviewEntry = { ...byNumber(238), confirm: { ...byNumber(238).confirm, material: "unknown" } };
    expect(reviewActions(entry).approve?.body.material).toBe("unknown");
  });
});

describe("confirmEntry", () => {
  let body: EntryConfirm;
  beforeAll(() => {
    body = reviewActions(byNumber(238)).approve!.body;
  });
  const answer = (status: number): typeof fetch => (async () => new Response(null, { status })) as unknown as typeof fetch;

  it("patches the entry with the body as json", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetcher = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    expect(await confirmEntry("abc", body, fetcher)).toBe("ok");
    expect(seen!.url).toBe("/api/entries/abc");
    expect(seen!.init.method).toBe("PATCH");
    expect(new Headers(seen!.init.headers).get("x-ulat-expect-status")).toBe("needs_review");
    expect(JSON.parse(seen!.init.body as string)).toEqual(body);
  });

  it("names the failures the page can say something about", async () => {
    expect(await confirmEntry("abc", body, answer(401))).toBe("unauthorized");
    expect(await confirmEntry("abc", body, answer(404))).toBe("not_found");
    expect(await confirmEntry("abc", body, answer(409))).toBe("settled");
    expect(await confirmEntry("abc", body, answer(500))).toBe("failed");
    expect(await confirmEntry("abc", body, (async () => Promise.reject(new Error("offline"))) as unknown as typeof fetch)).toBe("failed");
  });
});

describe("ask for photos", () => {
  const events = () => db.select().from(schema.events).where(eq(schema.events.type, PHOTOS_REQUESTED)).all();

  it("writes one staff event for the entry and keeps it in review", () => {
    const entry = byNumber(239);
    const now = new Date("2026-10-10T06:59:00.000Z");
    expect(askForPhotos(db, entry.id, now)).toEqual({ ok: true, already: false });
    const rows = events().filter((e) => e.entity_id === entry.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entity: "entry", actor: "staff", at: now.toISOString() });
    expect(db.select({ status: schema.entries.status }).from(schema.entries).where(eq(schema.entries.id, entry.id)).get()?.status).toBe("needs_review");
  });

  it("carries what the AI wanted to see", () => {
    const entry = byNumber(241);
    db.update(schema.entries).set({ ai_need_more: "Roof from the side" }).where(eq(schema.entries.id, entry.id)).run();
    askForPhotos(db, entry.id, new Date("2026-10-10T06:59:00.000Z"));
    const row = events().find((e) => e.entity_id === entry.id);
    expect(row?.data).toEqual({ need_more: "Roof from the side" });
  });

  it("shows when staff asked, and writes nothing on a second ask", () => {
    const entry = byNumber(239);
    expect(entry.photos_asked_at).toBe("2026-10-10T06:59:00.000Z");
    expect(askForPhotos(db, entry.id)).toEqual({ ok: true, already: true });
    expect(events().filter((e) => e.entity_id === entry.id)).toHaveLength(1);
  });

  it("lets staff ask again once a photo has been added after the request", () => {
    const entry = byNumber(241);
    expect(entry.photos_asked_at).not.toBeNull();
    const after = new Date("2026-10-10T07:10:00.000Z").toISOString();
    db.insert(schema.events).values({ entity: "entry", entity_id: entry.id, type: "entry.photo_added", actor: "r1", data: {}, at: after }).run();
    expect(byNumber(241).photos_asked_at).toBeNull();
    expect(askForPhotos(db, entry.id, new Date("2026-10-10T07:11:00.000Z"))).toEqual({ ok: true, already: false });
    expect(byNumber(241).photos_asked_at).toBe("2026-10-10T07:11:00.000Z");
    expect(events().filter((e) => e.entity_id === entry.id)).toHaveLength(2);
  });

  it("lets staff ask again when the entry comes back to needs_review", () => {
    const entry = byNumber(238);
    askForPhotos(db, entry.id, new Date("2026-10-10T08:00:00.000Z"));
    expect(askForPhotos(db, entry.id, new Date("2026-10-10T08:01:00.000Z"))).toEqual({ ok: true, already: true });
    db.insert(schema.events).values({ entity: "entry", entity_id: entry.id, type: "entry.needs_review", actor: "r1", data: {}, at: "2026-10-10T08:30:00.000Z" }).run();
    expect(byNumber(238).photos_asked_at).toBeNull();
    expect(askForPhotos(db, entry.id, new Date("2026-10-10T08:31:00.000Z"))).toEqual({ ok: true, already: false });
  });

  it("refuses an entry that is not waiting for a second look", () => {
    const confirmed = db.select({ id: schema.entries.id }).from(schema.entries).where(eq(schema.entries.status, "confirmed")).limit(1).get();
    expect(askForPhotos(db, confirmed!.id)).toEqual({ ok: false, error: "not_in_review" });
    expect(askForPhotos(db, crypto.randomUUID())).toEqual({ ok: false, error: "not_found" });
    expect(events().filter((e) => e.entity_id === confirmed!.id)).toHaveLength(0);
  });
});
