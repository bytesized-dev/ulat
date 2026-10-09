// @vitest-environment node
import { mkdtempSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { pushSQLiteSchema } from "drizzle-kit/api";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceStored } from "@/lib/contracts";

const dir = mkdtempSync(join(tmpdir(), "ulat-voice-"));
process.env.DATABASE_PATH = join(dir, "test.db");
process.env.UPLOAD_DIR = join(dir, "uploads");

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));

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
const stored = () => readdirSync(process.env.UPLOAD_DIR!, { recursive: true }).filter((f) => String(f).includes("."));

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
      const day = new Date().toISOString().slice(0, 10);
      expect(await readFile(join(process.env.UPLOAD_DIR!, day, `${id}.webm`))).toHaveLength(200);
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
      const day = new Date().toISOString().slice(0, 10);
      expect(await readFile(join(process.env.UPLOAD_DIR!, day, `${id}.webm`))).toHaveLength(10);
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
      const day = new Date().toISOString().slice(0, 10);
      expect(made.row.voice_path).toBe(`${day}/${id}.webm`);
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
});
