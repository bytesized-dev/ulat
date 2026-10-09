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
import { NewReport, VoiceStored } from "@/lib/contracts";
import { draftFromReport } from "@/components/family/report-draft";
import { enqueue, flushQueue, memoryStore } from "@/components/family/offline-queue";
import { sendReport } from "@/components/family/send-report";
import { newClientId } from "@/components/family/client-id";

const dir = mkdtempSync(join(tmpdir(), "ulat-voice-"));
process.env.DATABASE_PATH = join(dir, "test.db");
process.env.UPLOAD_DIR = join(dir, "uploads");

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));

// The disk cap is 200 MB, so a test that fills it sets a small one for itself.
const limits = vi.hoisted(() => ({ cap: 200 * 1024 * 1024 }));
vi.mock("@/lib/audio-limits", async (original) => {
  const real = await original<typeof import("@/lib/audio-limits")>();
  return {
    ...real,
    get MAX_UNLINKED_VOICE_BYTES() {
      return limits.cap;
    },
  };
});

const uuid = () => crypto.randomUUID();
const audio = (size = 64, type = "audio/webm;codecs=opus") => new Blob([new Uint8Array(size).fill(7)], { type });

/** A multipart upload with the Content-Length the browser would send. */
async function upload(fields: { voice_id?: string; audio?: Blob | string }, headers: Record<string, string | null> = {}) {
  const form = new FormData();
  if (fields.voice_id !== undefined) form.set("voice_id", fields.voice_id);
  if (fields.audio !== undefined) form.set("audio", fields.audio);
  const probe = new Request("http://hub/api/reports/voice", { method: "POST", body: form });
  const body = Buffer.from(await probe.arrayBuffer());
  const merged: Record<string, string | null> = {
    "content-type": probe.headers.get("content-type"),
    "content-length": String(body.length),
    ...headers,
  };
  const clean = Object.fromEntries(Object.entries(merged).filter((e): e is [string, string] => e[1] !== null));
  return new Request("http://hub/api/reports/voice", { method: "POST", headers: clean, body });
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
const voiceFile = (id: string, ext = "webm") => join(process.env.UPLOAD_DIR!, "voice", today(), `${id}.${ext}`);
const stored = () => readdirSync(process.env.UPLOAD_DIR!, { recursive: true }).filter((f) => String(f).includes("."));
/** Makes a stored file look this old, for the sweep. */
const age = (id: string, ms: number) => {
  const then = new Date(Date.now() - ms);
  utimesSync(voiceFile(id), then, then);
};
const HOUR = 60 * 60 * 1000;

describe("family voice upload and linking", () => {
  let voice: typeof import("./route");
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
    voice = await import("./route");
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

  describe("POST /api/reports/voice", () => {
    it("stores the audio with no PIN and answers with the voice_id only", async () => {
      const id = uuid();
      const res = await voice.POST(await upload({ voice_id: id, audio: audio(200) }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(VoiceStored.parse(body)).toEqual({ voice_id: id });
      // Nothing else comes back: no path, no URL.
      expect(Object.keys(body)).toEqual(["voice_id"]);
      // Family voice has its own folder, apart from entry photos and notes.
      expect(await readFile(voiceFile(id))).toHaveLength(200);
      expect(stored()).toContain(join("voice", today(), `${id}.webm`));
    });

    it("does not serve audio back, to a family or by voice_id", async () => {
      const id = uuid();
      await voice.POST(await upload({ voice_id: id, audio: audio() }));
      expect((voice as Record<string, unknown>).GET).toBeUndefined();
      // The files route finds audio by report id, never by voice_id, and wants a PIN either way.
      expect((await files.GET(new Request(`http://hub/api/files/${id}`), fileCtx(id))).status).toBe(401);
      await signIn("staff");
      expect((await files.GET(new Request(`http://hub/api/files/${id}`), fileCtx(id))).status).toBe(404);
    });

    it("stores one file when the same recording arrives twice", async () => {
      const id = uuid();
      const before = stored().length;
      expect((await voice.POST(await upload({ voice_id: id, audio: audio(50) }))).status).toBe(201);
      expect((await voice.POST(await upload({ voice_id: id, audio: audio(50) }))).status).toBe(201);
      expect(stored().length).toBe(before + 1);
    });

    it("does not let a repeat overwrite the first recording", async () => {
      const id = uuid();
      await voice.POST(await upload({ voice_id: id, audio: audio(10) }));
      await voice.POST(await upload({ voice_id: id, audio: audio(99) }));
      expect(await readFile(voiceFile(id))).toHaveLength(10);
    });

    it("validates the fields", async () => {
      const before = stored().length;
      const bad = async (r: Promise<Request>, status: number, error: string) => {
        const res = await voice.POST(await r);
        expect([res.status, (await res.json()).error]).toEqual([status, error]);
      };
      await bad(upload({ audio: audio() }), 400, "bad_meta");
      await bad(upload({ voice_id: "not-a-uuid", audio: audio() }), 400, "bad_meta");
      await bad(upload({ voice_id: "../../etc/passwd", audio: audio() }), 400, "bad_meta");
      await bad(upload({ voice_id: uuid() }), 400, "bad_audio");
      await bad(upload({ voice_id: uuid(), audio: "text, not a file" }), 400, "bad_audio");
      await bad(upload({ voice_id: uuid(), audio: audio(0) }), 400, "bad_audio");
      await bad(upload({ voice_id: uuid(), audio: audio(10, "image/png") }), 400, "audio_type_not_allowed");
      await bad(upload({ voice_id: uuid(), audio: audio(10, "") }), 400, "audio_type_not_allowed");
      expect(stored().length).toBe(before);
    });

    it("takes the AI voice route's size limits: 1 MB compressed, 6 MB for WAV", async () => {
      const before = stored().length;
      const tooBig = await voice.POST(await upload({ voice_id: uuid(), audio: audio(1024 * 1024 + 1) }));
      expect([tooBig.status, (await tooBig.json()).error]).toEqual([413, "too_large"]);
      expect(stored().length).toBe(before);
      expect((await voice.POST(await upload({ voice_id: uuid(), audio: audio(1024 * 1024) }))).status).toBe(201);
      expect((await voice.POST(await upload({ voice_id: uuid(), audio: audio(3 * 1024 * 1024, "audio/wav") }))).status).toBe(201);
      expect((await voice.POST(await upload({ voice_id: uuid(), audio: audio(6 * 1024 * 1024 + 1, "audio/wav") }))).status).toBe(413);
    });

    it("turns away a body whose declared length is too big or missing before reading it", async () => {
      const huge = await upload({ voice_id: uuid(), audio: audio() }, { "content-length": String(7 * 1024 * 1024) });
      expect((await voice.POST(huge)).status).toBe(413);
      const chunked = await upload({ voice_id: uuid(), audio: audio() }, { "content-length": null });
      expect((await voice.POST(chunked)).status).toBe(411);
    });
  });

  describe("POST /api/reports with a voice_id", () => {
    const send = async (size = 80) => {
      const id = uuid();
      await voice.POST(await upload({ voice_id: id, audio: audio(size) }));
      return id;
    };

    it("links the stored file, and responders and staff can play it", async () => {
      const id = await send(120);
      const made = await create({ voice_id: id });
      expect(made.res.status).toBe(201);
      expect(made.row.voice_path).toBe(`voice/${today()}/${id}.webm`);
      expect(createdAudit(made.row.id).data).toMatchObject({ voice_id: id, voice: "attached" });

      // No PIN, no audio.
      const req = () => new Request(`http://hub/api/files/${made.row.id}`);
      expect((await files.GET(req(), fileCtx(made.row.id))).status).toBe(401);
      for (const who of ["responder", "staff"] as const) {
        await signIn(who);
        const res = await files.GET(req(), fileCtx(made.row.id));
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("audio/webm");
        expect(Buffer.from(await res.arrayBuffer())).toHaveLength(120);
      }
    });

    it("leaves voice_path null for a typed report", async () => {
      const made = await create({ voice_id: null });
      expect(made.res.status).toBe(201);
      expect(made.row.voice_path).toBeNull();
      expect(createdAudit(made.row.id).data).not.toHaveProperty("voice");
    });

    it("saves the report without audio for a voice_id nobody uploaded, and says why in the audit", async () => {
      const made = await create({ voice_id: uuid() });
      expect(made.res.status).toBe(201);
      expect(made.row.voice_path).toBeNull();
      expect(createdAudit(made.row.id).data).toMatchObject({ voice: "unknown" });
    });

    it("gives a recording to the first report only", async () => {
      const id = await send();
      const first = await create({ voice_id: id, client_id: uuid() });
      const second = await create({ voice_id: id, client_id: uuid(), household_head: "Reyes" });
      expect(first.row.voice_path).not.toBeNull();
      // The second report is saved, it just does not get another family's audio.
      expect(second.res.status).toBe(201);
      expect(second.code).not.toBe(first.code);
      expect(second.row.voice_path).toBeNull();
      expect(createdAudit(second.row.id).data).toMatchObject({ voice: "used" });
      expect(db.select().from(schema.reports).where(eq(schema.reports.id, first.row.id)).get()!.voice_path).toBe(first.row.voice_path);
    });

    it("answers a missing and a used voice_id the same, so none can be probed for", async () => {
      const id = await send();
      await create({ voice_id: id, client_id: uuid() });
      const answer = async (voice_id: string) => {
        const res = await reportsRoute.POST(post(report({ voice_id, client_id: uuid() })));
        return [res.status, Object.keys(await res.json())];
      };
      expect(await answer(id)).toEqual([201, ["code"]]);
      expect(await answer(uuid())).toEqual([201, ["code"]]);
    });

    it("makes one report and keeps one file when the phone sends the same tap again", async () => {
      const id = await send();
      const clientId = uuid();
      const filesBefore = stored().length;
      const reportsBefore = db.select().from(schema.reports).all().length;
      const a = await create({ voice_id: id, client_id: clientId });
      // The reply was lost, so the phone uploads and posts again with the same ids.
      await voice.POST(await upload({ voice_id: id, audio: audio(80) }));
      const b = await create({ voice_id: id, client_id: clientId });
      expect(b.code).toBe(a.code);
      expect(db.select().from(schema.reports).all().length).toBe(reportsBefore + 1);
      expect(stored().length).toBe(filesBefore);
      expect(b.row.voice_path).toBe(a.row.voice_path);
      // The resend did not add a second created row to the audit trail.
      const created = db.select().from(schema.events).where(eq(schema.events.entity_id, a.row.id)).all().filter((e) => e.type === "report.created");
      expect(created).toHaveLength(1);
    });
  });
  describe("the disk bound", () => {
    // Earlier tests left recordings behind, and they count towards the cap.
    beforeEach(() => rmSync(join(process.env.UPLOAD_DIR!, "voice"), { recursive: true, force: true }));
    afterEach(() => {
      limits.cap = 200 * 1024 * 1024;
    });

    const put = async (id: string, size: number) => voice.POST(await upload({ voice_id: id, audio: audio(size) }));

    it("answers 507 before writing once unlinked recordings fill the cap", async () => {
      limits.cap = 1000;
      const first = uuid();
      expect((await put(first, 600)).status).toBe(201);
      const full = await put(uuid(), 600);
      expect([full.status, (await full.json()).error]).toEqual([507, "storage_full"]);
      expect(stored()).toHaveLength(1);
      // The same recording again adds no bytes, so a phone retrying it is not turned away.
      expect((await put(first, 600)).status).toBe(201);
      expect(stored()).toHaveLength(1);
    });

    it("does not count a recording a report has taken", async () => {
      limits.cap = 1000;
      const first = uuid();
      await put(first, 600);
      expect((await put(uuid(), 600)).status).toBe(507);
      await create({ voice_id: first });
      expect((await put(uuid(), 600)).status).toBe(201);
      expect(stored()).toHaveLength(2);
    });

    it("sweeps unlinked recordings over an hour old, and keeps linked and fresh ones", async () => {
      const [oldUnlinked, oldLinked, fresh, trigger] = [uuid(), uuid(), uuid(), uuid()];
      for (const id of [oldUnlinked, oldLinked, fresh]) await put(id, 50);
      await create({ voice_id: oldLinked });
      age(oldUnlinked, 2 * HOUR);
      age(oldLinked, 2 * HOUR);
      age(fresh, 5 * 60 * 1000);

      // The sweep runs on an upload.
      expect((await put(trigger, 50)).status).toBe(201);
      expect(existsSync(voiceFile(oldUnlinked))).toBe(false);
      expect(existsSync(voiceFile(oldLinked))).toBe(true);
      expect(existsSync(voiceFile(fresh))).toBe(true);
      expect(existsSync(voiceFile(trigger))).toBe(true);
    });

    it("frees room by sweeping, so a full hub takes uploads again an hour later", async () => {
      limits.cap = 1000;
      const stale = uuid();
      await put(stale, 600);
      expect((await put(uuid(), 600)).status).toBe(507);
      age(stale, 2 * HOUR);
      expect((await put(uuid(), 600)).status).toBe(201);
      expect(existsSync(voiceFile(stale))).toBe(false);
    });

    it("keeps a recording the phone sends again, so the report on its way can still take it", async () => {
      const id = uuid();
      await put(id, 50);
      age(id, 2 * HOUR);
      await put(id, 50);
      await put(uuid(), 50);
      expect(existsSync(voiceFile(id))).toBe(true);
    });

    it("never links a photo or a responder note that shares a name with a voice_id", async () => {
      const id = uuid();
      const day = join(process.env.UPLOAD_DIR!, today());
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(day, { recursive: true });
      writeFileSync(join(day, `${id}.webm`), "a responder note");
      writeFileSync(join(day, `${id}.jpg`), "an entry photo");
      const made = await create({ voice_id: id });
      expect(made.row.voice_path).toBeNull();
      expect(createdAudit(made.row.id).data).toMatchObject({ voice: "unknown" });
    });
  });

  describe("a queued report that the hub refuses after its audio went", () => {
    /** The phone's fetch, pointed at the route handlers. The first report post is refused. */
    function phone() {
      let refuse = true;
      return (async (url: string, init?: RequestInit) => {
        if (url.startsWith("/api/health")) return Response.json({ ok: true });
        let req = new Request(`http://hub${url}`, init);
        if (init?.body instanceof FormData) {
          const bytes = Buffer.from(await req.arrayBuffer());
          req = new Request(req.url, { method: "POST", headers: { "content-type": req.headers.get("content-type")!, "content-length": String(bytes.length) }, body: bytes });
        }
        if (url === "/api/reports/voice") return voice.POST(req);
        if (refuse) {
          refuse = false;
          return Response.json({ error: "bad_report" }, { status: 400 });
        }
        return reportsRoute.POST(req);
      }) as typeof fetch;
    }

    it("keeps the recording, and the fixed report sends it again: one report, one file, voice_path set", async () => {
      rmSync(join(process.env.UPLOAD_DIR!, "voice"), { recursive: true, force: true });
      const send = phone();
      const id = uuid();
      const reportsBefore = db.select().from(schema.reports).all().length;
      const note = new Blob([new Uint8Array(120).fill(3)], { type: "audio/webm;codecs=opus" });
      const store = memoryStore();
      await enqueue(store, NewReport.parse(report({ voice_id: id })), [{ kind: "audio", name: "note.webm", blob: note }]);

      // The audio reaches the hub, then the hub refuses the report.
      expect(await flushQueue(store, send)).toMatchObject({ sent: [], refused: 1 });
      expect(existsSync(voiceFile(id))).toBe(true);
      expect(db.select().from(schema.reports).all()).toHaveLength(reportsBefore);
      const [refused] = await store.list();
      expect(refused.attachments).toHaveLength(1);

      // The family taps fix: the draft and the recording come back, and Send goes again.
      const recording = refused.attachments.find((a) => a.kind === "audio")!.blob;
      await store.remove(refused.id);
      const sent = await sendReport(draftFromReport(refused.report), send, newClientId(), recording);
      expect(sent).toMatchObject({ ok: true });

      const rows = db.select().from(schema.reports).all();
      expect(rows).toHaveLength(reportsBefore + 1);
      const row = rows.find((r) => r.code === (sent as { code: string }).code)!;
      expect(row.voice_path).toBe(`voice/${today()}/${id}.webm`);
      expect(stored().filter((f) => String(f).startsWith("voice") && String(f).endsWith(".webm"))).toEqual([join("voice", today(), `${id}.webm`)]);
    });
  });
});
