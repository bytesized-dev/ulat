// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { pushSQLiteSchema } from "drizzle-kit/api";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "ulat-cant-assess-"));
process.env.DATABASE_PATH = join(dir, "test.db");

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));

const post = (body: unknown) =>
  new Request("http://hub/api/reports/K7P4/cant-assess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });

describe("POST /api/reports/[code]/cant-assess", () => {
  let route: typeof import("./route");
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let session: typeof import("@/lib/auth/session");
  let seen: unknown[] = [];

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

  const make = async (status: "waiting" | "visited" = "waiting") => {
    const res = await (await import("../../route")).POST(
      new Request("http://hub/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
          what_happened: null,
          needs: [],
          voice_id: null,
          transcript: null,
          english: null,
          language: null,
          consent: true,
        }),
      }),
    );
    const made = ((await res.json()) as { code: string }).code;
    if (status !== "waiting") db.update(schema.reports).set({ status }).where(eq(schema.reports.code, made)).run();
    return made;
  };
  const row = (c: string) => db.select().from(schema.reports).where(eq(schema.reports.code, c)).get()!;

  beforeAll(async () => {
    const sqlite = new Database(process.env.DATABASE_PATH!);
    schema = await import("@/db/schema");
    const push = await pushSQLiteSchema(schema as unknown as Record<string, unknown>, drizzle({ client: sqlite }) as never);
    sqlite.exec(push.statementsToExecute.join(String.fromCharCode(10)));
    sqlite.close();
    ({ db } = await import("@/db/client"));
    route = await import("./route");
    session = await import("@/lib/auth/session");
    const bus = await import("@/lib/live/bus");
    bus.subscribe({ role: "staff" }, (e: unknown) => seen.push(e));
    db.insert(schema.responders).values({ id: "r1", name: "Mae Santos", team: "A", active: true }).run();
  });

  beforeEach(() => {
    jar.clear();
    seen = [];
  });

  it("keeps it behind the responder PIN", async () => {
    const c = await make();
    expect((await route.POST(post({ reason: "cant_find", note: null }), ctx(c))).status).toBe(401);
    await signIn("staff");
    expect((await route.POST(post({ reason: "cant_find", note: null }), ctx(c))).status).toBe(403);
    expect(row(c).status).toBe("waiting");
  });

  it("answers a laptop that holds both cookies as the responder", async () => {
    const c = await make();
    await signIn("responder");
    const responder = new Map(jar);
    await signIn("staff");
    for (const [name, value] of responder) jar.set(name, value);
    expect((await route.POST(post({ reason: "cant_find", note: null }), ctx(c))).status).toBe(200);
    expect(row(c).status).toBe("cant_assess");
  });

  it("validates the body and the code", async () => {
    const c = await make();
    await signIn("responder");
    expect((await route.POST(post("{nope"), ctx(c))).status).toBe(400);
    expect((await route.POST(post({ reason: "bored", note: null }), ctx(c))).status).toBe(400);
    expect((await route.POST(post({ reason: "other", note: "x".repeat(241) }), ctx(c))).status).toBe(400);
    expect((await route.POST(post({ reason: "other", note: null }), ctx("nope"))).status).toBe(400);
    expect((await route.POST(post({ reason: "other", note: null }), ctx("ZZZZ"))).status).toBe(404);
  });

  it("marks the report, writes the reason to the audit trail and tells the hub", async () => {
    const c = await make();
    await signIn("responder");
    const res = await route.POST(post({ reason: "road_blocked", note: "  Bridge is out  " }), ctx(c));
    expect(res.status).toBe(200);
    expect(row(c)).toMatchObject({ status: "cant_assess", cant_reason: "road_blocked", cant_note: "Bridge is out" });
    const trail = db.select().from(schema.events).where(eq(schema.events.entity_id, row(c).id)).all();
    const last = trail[trail.length - 1];
    expect(last).toMatchObject({ type: "report.status_changed", actor: "r1" });
    expect(last.data).toMatchObject({ status: "cant_assess", reason: "road_blocked", note: "Bridge is out" });
    expect(seen).toContainEqual({ type: "report.updated", code: c, status: "cant_assess" });
  });

  it("does not reopen a closed report", async () => {
    const c = await make("visited");
    await signIn("responder");
    expect((await route.POST(post({ reason: "other", note: null }), ctx(c))).status).toBe(409);
    expect(row(c).status).toBe("visited");
  });
});
