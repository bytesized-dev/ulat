// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync } from "node:fs";
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

// The caps are 500 MB and 2000 files unlinked and 5 GB in all, and a sweep runs once a minute.
// Every file counts as whole 4 KiB blocks. A test that fills a cap sets its own numbers.
const DEFAULTS = { cap: 500 * 1024 * 1024, folderCap: 5 * 1024 * 1024 * 1024, fileCap: 2000, sweepEvery: 60 * 1000 };
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

const uuid = () => crypto.randomUUID();
const photo = (size = 2000, type = "image/jpeg") => new Blob([new Uint8Array(size).fill(7)], { type });

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
  voice_id: null,
  photo_id: null,
  transcript: "Nawala ang atop",
  english: "The roof is gone",
  language: "ceb",
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
const stored = () => readdirSync(process.env.UPLOAD_DIR!, { recursive: true }).filter((f) => String(f).includes("."));
const storedPhotos = () => stored().filter((f) => String(f).startsWith("photo"));
/** Makes a stored file look this old, for the sweep. */
const age = (id: string, ms: number) => {
  const then = new Date(Date.now() - ms);
  utimesSync(photoFile(id), then, then);
};
const HOUR = 60 * 60 * 1000;
const BLOCK = 4096;

describe("family photo upload and linking", () => {
  let route: typeof import("./route");
  let voice: typeof import("../voice/route");
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
    route = await import("./route");
    voice = await import("../voice/route");
    reportsRoute = await import("../route");
    files = await import("../../files/[id]/route");
    session = await import("@/lib/auth/session");
    db.insert(schema.responders).values({ id: "r1", name: "Mae Santos", team: "A", active: true }).run();
  });
  beforeEach(() => jar.clear());

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
      const res = await route.POST(await upload({ photo_id: id, photo: photo(2000) }));
      expect(res.status).toBe(201);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const body = await res.json();
      expect(PhotoStored.parse(body)).toEqual({ photo_id: id });
      // Nothing else comes back: no path, no URL.
      expect(Object.keys(body)).toEqual(["photo_id"]);
      // Family photos have their own folder, apart from entry photos.
      expect(await readFile(photoFile(id))).toHaveLength(2000);
      expect(storedPhotos()).toContain(join("photo", today(), `${id}.jpg`));
    });

    it("does not serve the photo back, to a family or by photo_id, until a report links it", async () => {
      const id = uuid();
      await route.POST(await upload({ photo_id: id, photo: photo() }));
      expect((route as Record<string, unknown>).GET).toBeUndefined();
      expect((await files.GET(new Request(`http://hub/api/files/${id}`), fileCtx(id))).status).toBe(401);
      await signIn("staff");
      expect((await files.GET(new Request(`http://hub/api/files/${id}`), fileCtx(id))).status).toBe(404);
    });

    it.each([
      ["image/jpeg", "jpg"],
      ["image/png", "png"],
      ["image/webp", "webp"],
      ["image/heic", "heic"],
    ])("takes %s", async (type, ext) => {
      const id = uuid();
      expect((await route.POST(await upload({ photo_id: id, photo: photo(2000, type) }))).status).toBe(201);
      expect(existsSync(photoFile(id, ext))).toBe(true);
    });

    it("stores one file when the same photo arrives twice", async () => {
      const id = uuid();
      const before = stored().length;
      expect((await route.POST(await upload({ photo_id: id, photo: photo() }))).status).toBe(201);
      expect((await route.POST(await upload({ photo_id: id, photo: photo() }))).status).toBe(201);
      expect(stored().length).toBe(before + 1);
    });

    it("does not let a repeat overwrite the first photo", async () => {
      const id = uuid();
      await route.POST(await upload({ photo_id: id, photo: photo(2000) }));
      await route.POST(await upload({ photo_id: id, photo: photo(3000) }));
      expect(await readFile(photoFile(id))).toHaveLength(2000);
    });

    it("validates the fields and the type", async () => {
      const before = stored().length;
      const bad = async (r: Promise<Request>, status: number, error: string) => {
        const res = await route.POST(await r);
        expect([res.status, (await res.json()).error]).toEqual([status, error]);
      };
      await bad(upload({ photo: photo() }), 400, "bad_meta");
      await bad(upload({ photo_id: "not-a-uuid", photo: photo() }), 400, "bad_meta");
      await bad(upload({ photo_id: "../../etc/passwd", photo: photo() }), 400, "bad_meta");
      await bad(upload({ photo_id: uuid() }), 400, "bad_photo");
      await bad(upload({ photo_id: uuid(), photo: "text, not a file" }), 400, "bad_photo");
      await bad(upload({ photo_id: uuid(), photo: photo(0) }), 400, "bad_photo");
      await bad(upload({ photo_id: uuid(), photo: photo(2000, "image/gif") }), 400, "photo_type_not_allowed");
      await bad(upload({ photo_id: uuid(), photo: photo(2000, "audio/webm") }), 400, "photo_type_not_allowed");
      await bad(upload({ photo_id: uuid(), photo: photo(2000, "") }), 400, "photo_type_not_allowed");
      expect(stored().length).toBe(before);
    });

    it("takes a photo up to 10 MB and refuses one byte more", async () => {
      const before = stored().length;
      const tooBig = await route.POST(await upload({ photo_id: uuid(), photo: photo(10 * 1024 * 1024 + 1) }));
      expect([tooBig.status, (await tooBig.json()).error]).toEqual([413, "too_large"]);
      expect(stored().length).toBe(before);
      expect((await route.POST(await upload({ photo_id: uuid(), photo: photo(10 * 1024 * 1024) }))).status).toBe(201);
    });

    it("turns away a body whose declared length is too big or missing before reading it", async () => {
      const huge = await upload({ photo_id: uuid(), photo: photo() }, { "content-length": String(11 * 1024 * 1024) });
      expect((await route.POST(huge)).status).toBe(413);
      const chunked = await upload({ photo_id: uuid(), photo: photo() }, { "content-length": null });
      const res = await route.POST(chunked);
      expect([res.status, (await res.json()).error]).toEqual([411, "length_required"]);
      const letters = await upload({ photo_id: uuid(), photo: photo() }, { "content-length": "lots" });
      expect((await route.POST(letters)).status).toBe(411);
    });
  });

  describe("POST /api/reports with a photo_id", () => {
    const send = async (size = 2000, type = "image/jpeg") => {
      const id = uuid();
      await route.POST(await upload({ photo_id: id, photo: photo(size, type) }));
      return id;
    };

    it("links the stored file, and responders and staff can see it by photo_id", async () => {
      const id = await send(2000);
      const made = await create({ photo_id: id });
      expect(made.res.status).toBe(201);
      expect(made.row.photo_path).toBe(`photo/${today()}/${id}.jpg`);
      expect(photoRows(id)).toEqual([expect.objectContaining({ id, report_id: made.row.id, entry_id: null, path: made.row.photo_path })]);
      expect(createdAudit(made.row.id).data).toMatchObject({ photo_id: id, photo: "attached" });

      // No PIN, no photo.
      const req = () => new Request(`http://hub/api/files/${id}`);
      expect((await files.GET(req(), fileCtx(id))).status).toBe(401);
      for (const who of ["responder", "staff"] as const) {
        await signIn(who);
        const res = await files.GET(req(), fileCtx(id));
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/jpeg");
        expect(Buffer.from(await res.arrayBuffer())).toHaveLength(2000);
      }
    });

    it("serves a PNG as a PNG", async () => {
      const id = await send(2000, "image/png");
      await create({ photo_id: id });
      await signIn("responder");
      const res = await files.GET(new Request(`http://hub/api/files/${id}`), fileCtx(id));
      expect(res.headers.get("content-type")).toBe("image/png");
    });

    it("leaves photo_path null and writes no photos row for a report without a photo", async () => {
      const rowsBefore = db.select().from(schema.photos).all().length;
      const made = await create({ photo_id: null });
      expect(made.res.status).toBe(201);
      expect(made.row.photo_path).toBeNull();
      expect(createdAudit(made.row.id).data).not.toHaveProperty("photo");
      expect(db.select().from(schema.photos).all()).toHaveLength(rowsBefore);
    });

    it("still takes a report from a phone that sends no photo_id at all", async () => {
      const { photo_id: _omitted, ...older } = report();
      const res = await reportsRoute.POST(post(older));
      expect(res.status).toBe(201);
    });

    it("saves the report without a photo for a photo_id nobody uploaded, and says why in the audit", async () => {
      const id = uuid();
      const made = await create({ photo_id: id });
      expect(made.res.status).toBe(201);
      expect(made.row.photo_path).toBeNull();
      expect(photoRows(id)).toHaveLength(0);
      expect(createdAudit(made.row.id).data).toMatchObject({ photo_id: id, photo: "unknown" });
    });

    it("gives a photo to the first report only", async () => {
      const id = await send();
      const first = await create({ photo_id: id, client_id: uuid() });
      const second = await create({ photo_id: id, client_id: uuid(), household_head: "Reyes" });
      expect(first.row.photo_path).not.toBeNull();
      // The second report is saved, it just does not get another family's photo.
      expect(second.res.status).toBe(201);
      expect(second.code).not.toBe(first.code);
      expect(second.row.photo_path).toBeNull();
      expect(createdAudit(second.row.id).data).toMatchObject({ photo: "used" });
      // One row, still the first report's.
      expect(photoRows(id)).toEqual([expect.objectContaining({ report_id: first.row.id })]);
    });

    it("answers a missing and a used photo_id the same, so none can be probed for", async () => {
      const id = await send();
      await create({ photo_id: id, client_id: uuid() });
      const answer = async (photo_id: string) => {
        const res = await reportsRoute.POST(post(report({ photo_id, client_id: uuid() })));
        return [res.status, Object.keys(await res.json())];
      };
      expect(await answer(id)).toEqual([201, ["code"]]);
      expect(await answer(uuid())).toEqual([201, ["code"]]);
    });

    it("makes one report, one file and one photos row when the phone sends the same tap again", async () => {
      const id = await send();
      const clientId = uuid();
      const filesBefore = stored().length;
      const reportsBefore = db.select().from(schema.reports).all().length;
      const a = await create({ photo_id: id, client_id: clientId });
      // The reply was lost, so the phone uploads and posts again with the same ids.
      await route.POST(await upload({ photo_id: id, photo: photo() }));
      const b = await create({ photo_id: id, client_id: clientId });
      expect(b.code).toBe(a.code);
      expect(db.select().from(schema.reports).all().length).toBe(reportsBefore + 1);
      expect(stored().length).toBe(filesBefore);
      expect(photoRows(id)).toHaveLength(1);
      expect(b.row.photo_path).toBe(a.row.photo_path);
      const created = db.select().from(schema.events).where(eq(schema.events.entity_id, a.row.id)).all().filter((e) => e.type === "report.created");
      expect(created).toHaveLength(1);
    });

    it("links a photo and a voice note to one report, each from its own folder", async () => {
      const photoId = await send();
      const voiceId = uuid();
      const note = new Blob([new Uint8Array(2000).fill(3)], { type: "audio/webm" });
      const form = new FormData();
      form.set("voice_id", voiceId);
      form.set("audio", note);
      const probe = new Request("http://hub/api/reports/voice", { method: "POST", body: form });
      const bytes = Buffer.from(await probe.arrayBuffer());
      const voiceReq = new Request(probe.url, { method: "POST", headers: { "content-type": probe.headers.get("content-type")!, "content-length": String(bytes.length) }, body: bytes });
      expect((await voice.POST(voiceReq)).status).toBe(201);
      const made = await create({ photo_id: photoId, voice_id: voiceId });
      expect(made.row.photo_path).toBe(`photo/${today()}/${photoId}.jpg`);
      expect(made.row.voice_path).toBe(`voice/${today()}/${voiceId}.webm`);
    });

    it("never links a voice file, an entry photo or a responder photo that shares a name with a photo_id", async () => {
      const id = uuid();
      const { mkdirSync, writeFileSync } = await import("node:fs");
      // Where a responder photo lands, and where a family voice note with the same id would.
      mkdirSync(join(process.env.UPLOAD_DIR!, today()), { recursive: true });
      writeFileSync(join(process.env.UPLOAD_DIR!, today(), `${id}.jpg`), "an entry photo");
      mkdirSync(join(process.env.UPLOAD_DIR!, "voice", today()), { recursive: true });
      writeFileSync(join(process.env.UPLOAD_DIR!, "voice", today(), `${id}.webm`), "a family recording");
      const made = await create({ photo_id: id });
      expect(made.row.photo_path).toBeNull();
      expect(createdAudit(made.row.id).data).toMatchObject({ photo: "unknown" });
    });
  });

  describe("the disk bound", () => {
    // Earlier tests left photos behind, and they count towards the cap.
    beforeEach(() => {
      rmSync(join(process.env.UPLOAD_DIR!, "photo"), { recursive: true, force: true });
      // Sweep on every upload, so each test sees exact counts unless it says otherwise.
      limits.sweepEvery = 0;
    });
    afterEach(() => Object.assign(limits, DEFAULTS));

    const put = async (id: string, size: number) => route.POST(await upload({ photo_id: id, photo: photo(size) }));

    it("answers 507 before writing once unlinked photos fill the cap", async () => {
      limits.cap = BLOCK + 2000;
      const first = uuid();
      expect((await put(first, 2000)).status).toBe(201);
      const full = await put(uuid(), 2000);
      expect([full.status, (await full.json()).error]).toEqual([507, "storage_full"]);
      expect(storedPhotos()).toHaveLength(1);
      // The same photo again adds no bytes, so a phone retrying it is not turned away.
      expect((await put(first, 2000)).status).toBe(201);
      expect(storedPhotos()).toHaveLength(1);
    });

    it("does not count a photo a report has taken", async () => {
      limits.cap = BLOCK + 2000;
      const first = uuid();
      await put(first, 2000);
      expect((await put(uuid(), 2000)).status).toBe(507);
      await create({ photo_id: first });
      expect((await put(uuid(), 2000)).status).toBe(201);
      expect(storedPhotos()).toHaveLength(2);
    });

    it("counts a tiny photo as a whole block, and limits how many there are", async () => {
      limits.cap = 2 * BLOCK;
      const statuses = [];
      for (let i = 0; i < 4; i++) statuses.push((await put(uuid(), 100)).status);
      expect(statuses).toEqual([201, 201, 507, 507]);
      limits.cap = DEFAULTS.cap;
      rmSync(join(process.env.UPLOAD_DIR!, "photo"), { recursive: true, force: true });
      limits.fileCap = 3;
      const more = [];
      for (let i = 0; i < 5; i++) more.push((await put(uuid(), 100)).status);
      expect(more).toEqual([201, 201, 201, 507, 507]);
    });

    it("answers 507 once the whole folder is full, even when every photo is linked", async () => {
      limits.folderCap = 2 * BLOCK;
      for (let round = 0; round < 2; round++) {
        const id = uuid();
        expect((await put(id, 2000)).status).toBe(201);
        expect((await create({ photo_id: id })).row.photo_path).not.toBeNull();
      }
      const full = await put(uuid(), 2000);
      expect([full.status, (await full.json()).error]).toEqual([507, "storage_full"]);
      expect(storedPhotos()).toHaveLength(2);
    });

    it("still accepts the report when the folder is full, with photo_path null", async () => {
      limits.folderCap = BLOCK;
      const kept = uuid();
      await put(kept, 2000);
      await create({ photo_id: kept });
      const refused = uuid();
      expect((await put(refused, 2000)).status).toBe(507);
      const made = await create({ photo_id: refused });
      expect(made.res.status).toBe(201);
      expect(made.row.photo_path).toBeNull();
      expect(createdAudit(made.row.id).data).toMatchObject({ photo: "unknown" });
    });

    it("keeps the photo folder's caps apart from the voice folder's", async () => {
      limits.cap = BLOCK;
      expect((await put(uuid(), 2000)).status).toBe(201);
      expect((await put(uuid(), 2000)).status).toBe(507);
      // A full photo folder does not turn away a recording.
      const form = new FormData();
      form.set("voice_id", uuid());
      form.set("audio", new Blob([new Uint8Array(2000).fill(3)], { type: "audio/webm" }));
      const probe = new Request("http://hub/api/reports/voice", { method: "POST", body: form });
      const bytes = Buffer.from(await probe.arrayBuffer());
      const res = await voice.POST(new Request(probe.url, { method: "POST", headers: { "content-type": probe.headers.get("content-type")!, "content-length": String(bytes.length) }, body: bytes }));
      expect(res.status).toBe(201);
    });

    it("sweeps unlinked photos over an hour old, and keeps linked and fresh ones", async () => {
      const [oldUnlinked, oldLinked, fresh, trigger] = [uuid(), uuid(), uuid(), uuid()];
      for (const id of [oldUnlinked, oldLinked, fresh]) await put(id, 2000);
      await create({ photo_id: oldLinked });
      age(oldUnlinked, 2 * HOUR);
      age(oldLinked, 2 * HOUR);
      age(fresh, 5 * 60 * 1000);

      // The sweep runs on an upload.
      expect((await put(trigger, 2000)).status).toBe(201);
      expect(existsSync(photoFile(oldUnlinked))).toBe(false);
      expect(existsSync(photoFile(oldLinked))).toBe(true);
      expect(existsSync(photoFile(fresh))).toBe(true);
      expect(existsSync(photoFile(trigger))).toBe(true);
    });

    it("frees room by sweeping, so a full hub takes uploads again an hour later", async () => {
      limits.cap = BLOCK + 2000;
      const stale = uuid();
      await put(stale, 2000);
      expect((await put(uuid(), 2000)).status).toBe(507);
      age(stale, 2 * HOUR);
      expect((await put(uuid(), 2000)).status).toBe(201);
      expect(existsSync(photoFile(stale))).toBe(false);
    });

    it("keeps a photo the phone sends again, so the report on its way can still take it", async () => {
      const id = uuid();
      await put(id, 2000);
      age(id, 2 * HOUR);
      await put(id, 2000);
      await put(uuid(), 2000);
      expect(existsSync(photoFile(id))).toBe(true);
    });

    it("never put more on disk than the cap when uploads arrive together", async () => {
      limits.cap = 3 * BLOCK;
      const results = await Promise.all(Array.from({ length: 8 }, () => put(uuid(), 2000)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(3);
      expect(results.filter((r) => r.status === 507)).toHaveLength(5);
      expect(storedPhotos()).toHaveLength(3);
    });
  });
});
