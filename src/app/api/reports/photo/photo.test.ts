// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { pushSQLiteSchema } from "drizzle-kit/api";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoStored } from "@/lib/contracts";

const dir = mkdtempSync(join(tmpdir(), "ulat-photo-"));
process.env.DATABASE_PATH = join(dir, "test.db");
process.env.UPLOAD_DIR = join(dir, "uploads");

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));

// A linked photo is queued for the hub's reading. These tests are about storing
// and linking, so the reading never runs and never calls Ollama.
const reading = vi.hoisted(() => ({ queued: [] as string[] }));
vi.mock("@/lib/ai/draft-report", () => ({
  queueReportDraft: async (id: string) => void reading.queued.push(id),
}));

// The caps are 200 MB and 2000 files unlinked and 4 GB in all, and a sweep runs once a minute.
// A test that fills a cap sets its own numbers.
const DEFAULTS = { cap: 200 * 1024 * 1024, folderCap: 4 * 1024 * 1024 * 1024, fileCap: 2000, sweepEvery: 60 * 1000 };
const limits = vi.hoisted(() => ({ cap: 0, folderCap: 0, fileCap: 0, sweepEvery: 0 }));
Object.assign(limits, DEFAULTS);
vi.mock("@/lib/photo-limits", async (original) => {
  const real = await original<typeof import("@/lib/photo-limits")>();
  return {
    ...real,
    get MAX_UNLINKED_PHOTO_BYTES() {
      return limits.cap;
    },
    get MAX_PHOTO_FOLDER_BYTES() {
      return limits.folderCap;
    },
    get MAX_UNLINKED_PHOTO_FILES() {
      return limits.fileCap;
    },
    get PHOTO_SWEEP_EVERY_MS() {
      return limits.sweepEvery;
    },
  };
});

const MB = 1024 * 1024;
const BLOCK = 4096;
const HOUR = 60 * 60 * 1000;
const uuid = () => crypto.randomUUID();
const image = (size = 2000, type = "image/jpeg") => new Blob([new Uint8Array(size).fill(7)], { type });

/** A multipart upload with the Content-Length the browser would send. */
async function upload(fields: { photo_id?: string; photo?: Blob | string }, headers: Record<string, string | null> = {}) {
  const form = new FormData();
  if (fields.photo_id !== undefined) form.set("photo_id", fields.photo_id);
  if (fields.photo !== undefined) form.set("photo", fields.photo);
  const probe = new Request("http://hub/api/reports/photo", { method: "POST", body: form });
  const body = Buffer.from(await probe.arrayBuffer());
  const merged: Record<string, string | null> = {
    "content-type": probe.headers.get("content-type"),
    "content-length": String(body.length),
    ...headers,
  };
  const clean = Object.fromEntries(Object.entries(merged).filter((e): e is [string, string] => e[1] !== null));
  return new Request("http://hub/api/reports/photo", { method: "POST", headers: clean, body });
}

const report = (extra: object = {}) => ({
  source: "family",
  household_head: "Dela Cruz",
  reporter_name: null,
  reporter_where: null,
  barangay: "San Isidro",
  purok: "Purok 3",
  lat: 10.31,
  lng: 123.88,
  people: 5,
  hurt: 0,
  missing: 0,
  what_happened: "Roof gone",
  needs: ["water"],
  transcript: null,
  english: null,
  language: null,
  consent: true,
  ...extra,
});
const post = (body: unknown) =>
  new Request("http://hub/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const fileCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const today = () => new Date().toISOString().slice(0, 10);
const photoFile = (id: string, ext = "jpg") => join(process.env.UPLOAD_DIR!, "photo", today(), `${id}.${ext}`);
/** The files in the photo folder. */
const stored = () => {
  const folder = join(process.env.UPLOAD_DIR!, "photo");
  return existsSync(folder) ? readdirSync(folder, { recursive: true }).filter((f) => String(f).includes(".")).map((f) => join("photo", String(f))) : [];
};
const age = (id: string, ms: number) => {
  const then = new Date(Date.now() - ms);
  utimesSync(photoFile(id), then, then);
};

describe("family photo upload and linking", () => {
  let photo: typeof import("./route");
  let reportsRoute: typeof import("../route");
  let files: typeof import("../../files/[id]/route");
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let session: typeof import("@/lib/auth/session");

  const signIn = async (who: "staff" | "responder" | null) => {
    jar.clear();
    if (!who) return;
    const secret = await session.getSessionSecret();
    const exp = session.sessionExpiry();
    if (who === "staff") jar.set(session.SESSION_COOKIE.staff, session.signSession({ role: "staff", exp }, secret));
    else
      jar.set(
        session.SESSION_COOKIE.responder,
        session.signSession({ role: "responder", responder_id: "r1", name: "Mae Santos", exp }, secret),
      );
  };

  beforeAll(async () => {
    const sqlite = new Database(process.env.DATABASE_PATH!);
    schema = await import("@/db/schema");
    const push = await pushSQLiteSchema(schema as unknown as Record<string, unknown>, drizzle({ client: sqlite }) as never);
    sqlite.exec(push.statementsToExecute.join(String.fromCharCode(10)));
    sqlite.close();
    ({ db } = await import("@/db/client"));
    photo = await import("./route");
    reportsRoute = await import("../route");
    files = await import("../../files/[id]/route");
    session = await import("@/lib/auth/session");
    db.insert(schema.responders).values({ id: "r1", name: "Mae Santos", team: "A", active: true }).run();
  });
  beforeEach(() => {
    jar.clear();
    rmSync(join(process.env.UPLOAD_DIR!, "photo"), { recursive: true, force: true });
    limits.sweepEvery = 0;
  });
  afterEach(() => Object.assign(limits, DEFAULTS));

  const put = async (id: string, size = 2000, type = "image/jpeg") => photo.POST(await upload({ photo_id: id, photo: image(size, type) }));
  const create = async (extra: object = {}) => {
    const res = await reportsRoute.POST(post(report(extra)));
    const { code } = (await res.json()) as { code: string };
    return { res, code, row: db.select().from(schema.reports).where(eq(schema.reports.code, code)).get()! };
  };
  const createdAudit = (reportId: string) =>
    db.select().from(schema.events).where(eq(schema.events.entity_id, reportId)).all().find((e) => e.type === "report.created")!;
  const photoRows = (id: string) => db.select().from(schema.photos).where(eq(schema.photos.id, id)).all();

  describe("POST /api/reports/photo", () => {
    it("stores the photo with no PIN and answers with the photo_id only", async () => {
      const id = uuid();
      const res = await put(id);
      expect(res.status).toBe(201);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const body = await res.json();
      expect(PhotoStored.parse(body)).toEqual({ photo_id: id });
      expect(Object.keys(body)).toEqual(["photo_id"]);
      // Family photos have their own folder, apart from recordings and responder photos.
      expect(await readFile(photoFile(id))).toHaveLength(2000);
      expect(stored()).toContain(join("photo", today(), `${id}.jpg`));
    });

    it("keeps each type under its own extension", async () => {
      const types = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
      for (const [type, ext] of Object.entries(types)) {
        const id = uuid();
        expect((await put(id, 2000, type)).status).toBe(201);
        expect(existsSync(photoFile(id, ext))).toBe(true);
      }
    });

    it("stores one file when the same photo arrives twice, and keeps the first", async () => {
      const id = uuid();
      expect((await put(id, 2000)).status).toBe(201);
      const before = stored().length;
      expect((await put(id, 3000)).status).toBe(201);
      expect(stored().length).toBe(before);
      expect(await readFile(photoFile(id))).toHaveLength(2000);
    });

    it("turns away a wrong type", async () => {
      const res = await put(uuid(), 2000, "audio/webm");
      expect([res.status, (await res.json()).error]).toEqual([400, "photo_type_not_allowed"]);
      const none = await put(uuid(), 2000, "");
      expect([none.status, (await none.json()).error]).toEqual([400, "photo_type_not_allowed"]);
      expect(stored()).toHaveLength(0);
    });

    it("validates the fields", async () => {
      const bad = async (r: Promise<Request>, status: number, error: string) => {
        const res = await photo.POST(await r);
        expect([res.status, (await res.json()).error]).toEqual([status, error]);
      };
      await bad(upload({ photo: image() }), 400, "bad_meta");
      await bad(upload({ photo_id: "not-a-uuid", photo: image() }), 400, "bad_meta");
      await bad(upload({ photo_id: "../../etc/passwd", photo: image() }), 400, "bad_meta");
      await bad(upload({ photo_id: uuid() }), 400, "bad_photo");
      await bad(upload({ photo_id: uuid(), photo: "text, not a file" }), 400, "bad_photo");
      await bad(upload({ photo_id: uuid(), photo: image(0) }), 400, "bad_photo");
      expect(stored()).toHaveLength(0);
    });

    it("turns away a file under the 1 KB minimum and keeps one at it", async () => {
      for (const size of [1, 1023]) {
        const res = await put(uuid(), size);
        expect([res.status, (await res.json()).error]).toEqual([400, "photo_too_small"]);
      }
      expect(stored()).toHaveLength(0);
      expect((await put(uuid(), 1024)).status).toBe(201);
    });

    it("takes a photo up to 10 MB and turns away one byte more", async () => {
      expect((await put(uuid(), 10 * MB)).status).toBe(201);
      const before = stored().length;
      const big = await put(uuid(), 10 * MB + 1);
      expect([big.status, (await big.json()).error]).toEqual([413, "too_large"]);
      expect(stored().length).toBe(before);
    });

    it("turns away a declared length that is too big or missing before reading the body", async () => {
      const huge = await upload({ photo_id: uuid(), photo: image() }, { "content-length": String(11 * MB) });
      const tooBig = await photo.POST(huge);
      expect([tooBig.status, (await tooBig.json()).error]).toEqual([413, "too_large"]);
      const chunked = await upload({ photo_id: uuid(), photo: image() }, { "content-length": null });
      const missing = await photo.POST(chunked);
      expect([missing.status, (await missing.json()).error]).toEqual([411, "length_required"]);
      const odd = await upload({ photo_id: uuid(), photo: image() }, { "content-length": "12abc" });
      expect((await photo.POST(odd)).status).toBe(411);
      expect(stored()).toHaveLength(0);
    });

    it("does not serve the photo back by photo_id before a report links it", async () => {
      const id = uuid();
      await put(id);
      expect((photo as Record<string, unknown>).GET).toBeUndefined();
      expect((await files.GET(new Request(`http://hub/api/files/${id}`), fileCtx(id))).status).toBe(401);
      await signIn("staff");
      expect((await files.GET(new Request(`http://hub/api/files/${id}`), fileCtx(id))).status).toBe(404);
    });
  });

  describe("POST /api/reports with a photo_id", () => {
    it("links the stored photo once: photo_path, a photos row, and a clean audit row", async () => {
      const id = uuid();
      await put(id);
      const made = await create({ photo_id: id });
      expect(made.res.status).toBe(201);
      expect(made.row.photo_path).toBe(`photo/${today()}/${id}.jpg`);
      const rows = photoRows(id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id, report_id: made.row.id, path: `photo/${today()}/${id}.jpg`, entry_id: null });
      expect(createdAudit(made.row.id).data).toMatchObject({ photo_id: id, photo: "attached" });
    });

    it("serves the linked photo to staff and responders, and refuses a family", async () => {
      const id = uuid();
      await put(id, 2000);
      await create({ photo_id: id });
      const req = () => new Request(`http://hub/api/files/${id}`);
      expect((await files.GET(req(), fileCtx(id))).status).toBe(401);
      for (const who of ["staff", "responder"] as const) {
        await signIn(who);
        const res = await files.GET(req(), fileCtx(id));
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/jpeg");
        expect(Buffer.from(await res.arrayBuffer())).toHaveLength(2000);
      }
    });

    it("leaves photo_path null for a report with no photo", async () => {
      const made = await create({ photo_id: null });
      expect(made.res.status).toBe(201);
      expect(made.row.photo_path).toBeNull();
      expect(createdAudit(made.row.id).data).not.toHaveProperty("photo");
      // A report that does not name photo_id at all, as one queued before photos existed.
      const old = await reportsRoute.POST(post(report()));
      expect(old.status).toBe(201);
    });

    it("saves the report without the photo for a photo_id nobody uploaded, and says why in the audit", async () => {
      const id = uuid();
      const made = await create({ photo_id: id });
      expect(made.res.status).toBe(201);
      expect(made.row.photo_path).toBeNull();
      expect(photoRows(id)).toHaveLength(0);
      expect(createdAudit(made.row.id).data).toMatchObject({ photo_id: id, photo: "unknown" });
    });

    it("gives a photo to the first report only", async () => {
      const id = uuid();
      await put(id);
      const first = await create({ photo_id: id, client_id: uuid() });
      const second = await create({ photo_id: id, client_id: uuid(), household_head: "Reyes" });
      expect(first.row.photo_path).not.toBeNull();
      expect(second.res.status).toBe(201);
      expect(second.code).not.toBe(first.code);
      expect(second.row.photo_path).toBeNull();
      expect(createdAudit(second.row.id).data).toMatchObject({ photo: "used" });
      expect(photoRows(id)).toHaveLength(1);
      expect(photoRows(id)[0].report_id).toBe(first.row.id);
    });

    it("treats a photo a responder entry already holds as used", async () => {
      const id = uuid();
      await put(id);
      db.insert(schema.photos).values({ id, path: `photo/${today()}/${id}.jpg` }).run();
      const made = await create({ photo_id: id });
      expect(made.row.photo_path).toBeNull();
      expect(createdAudit(made.row.id).data).toMatchObject({ photo: "used" });
    });

    it("answers a missing and a used photo_id the same, so none can be probed for", async () => {
      const id = uuid();
      await put(id);
      await create({ photo_id: id, client_id: uuid() });
      const answer = async (photo_id: string) => {
        const res = await reportsRoute.POST(post(report({ photo_id, client_id: uuid() })));
        return [res.status, Object.keys(await res.json())];
      };
      expect(await answer(id)).toEqual([201, ["code"]]);
      expect(await answer(uuid())).toEqual([201, ["code"]]);
    });

    it("makes one report, one file and one photos row when the phone sends the same tap again", async () => {
      const id = uuid();
      const clientId = uuid();
      await put(id);
      const filesBefore = stored().length;
      const reportsBefore = db.select().from(schema.reports).all().length;
      const a = await create({ photo_id: id, client_id: clientId });
      // The reply was lost, so the phone uploads and posts again with the same ids.
      await put(id);
      const b = await create({ photo_id: id, client_id: clientId });
      expect(b.code).toBe(a.code);
      expect(db.select().from(schema.reports).all().length).toBe(reportsBefore + 1);
      expect(stored().length).toBe(filesBefore);
      expect(photoRows(id)).toHaveLength(1);
      expect(b.row.photo_path).toBe(a.row.photo_path);
      const created = db.select().from(schema.events).where(eq(schema.events.entity_id, a.row.id)).all().filter((e) => e.type === "report.created");
      expect(created).toHaveLength(1);
    });

    it("never links a voice recording that shares a name with a photo_id", async () => {
      const id = uuid();
      mkdirSync(join(process.env.UPLOAD_DIR!, "voice", today()), { recursive: true });
      writeFileSync(join(process.env.UPLOAD_DIR!, "voice", today(), `${id}.webm`), "voice");
      const made = await create({ photo_id: id });
      expect(made.row.photo_path).toBeNull();
      expect(createdAudit(made.row.id).data).toMatchObject({ photo: "unknown" });
    });
  });

  describe("the disk bound", () => {
    it("answers 507 before writing once unlinked photos fill the cap", async () => {
      limits.cap = BLOCK + 2000;
      const first = uuid();
      expect((await put(first)).status).toBe(201);
      const full = await put(uuid());
      expect([full.status, (await full.json()).error]).toEqual([507, "storage_full"]);
      expect(stored()).toHaveLength(1);
      // The same photo again adds no bytes, so a phone retrying it is not turned away.
      expect((await put(first)).status).toBe(201);
    });

    it("does not count a photo a report has taken", async () => {
      limits.cap = BLOCK + 2000;
      const first = uuid();
      await put(first);
      expect((await put(uuid())).status).toBe(507);
      await create({ photo_id: first });
      expect((await put(uuid())).status).toBe(201);
      expect(stored()).toHaveLength(2);
    });

    it("limits the number of small photos nobody has taken", async () => {
      limits.fileCap = 3;
      const statuses = [];
      for (let i = 0; i < 5; i++) statuses.push((await put(uuid(), 1024)).status);
      expect(statuses).toEqual([201, 201, 201, 507, 507]);
    });

    it("answers 507 once the whole folder is full, even when every photo is linked", async () => {
      limits.folderCap = 2 * BLOCK;
      for (let i = 0; i < 2; i++) {
        const id = uuid();
        await put(id, 1024);
        await create({ photo_id: id });
      }
      expect((await put(uuid(), 1024)).status).toBe(507);
    });

    it("still accepts the report when the folder is full, with photo_path null", async () => {
      limits.folderCap = 10;
      const id = uuid();
      expect((await put(id)).status).toBe(507);
      const made = await create({ photo_id: id });
      expect(made.res.status).toBe(201);
      expect(made.row.photo_path).toBeNull();
      expect(createdAudit(made.row.id).data).toMatchObject({ photo: "unknown" });
    });

    it("sweeps unlinked photos over an hour old, and keeps linked and fresh ones", async () => {
      const [linked, stale, fresh] = [uuid(), uuid(), uuid()];
      for (const id of [linked, stale, fresh]) await put(id);
      await create({ photo_id: linked });
      age(linked, 2 * HOUR);
      age(stale, 2 * HOUR);
      await put(uuid());
      expect(existsSync(photoFile(linked))).toBe(true);
      expect(existsSync(photoFile(stale))).toBe(false);
      expect(existsSync(photoFile(fresh))).toBe(true);
    });

    it("keeps a photo the phone sends again, so the report on its way can still take it", async () => {
      const id = uuid();
      await put(id);
      age(id, 2 * HOUR);
      await put(id);
      await put(uuid());
      expect(existsSync(photoFile(id))).toBe(true);
    });
  });
});
