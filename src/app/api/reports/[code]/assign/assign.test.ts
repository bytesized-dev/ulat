// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { pushSQLiteSchema } from "drizzle-kit/api";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { HubEvent } from "@/lib/contracts";

const dir = mkdtempSync(join(tmpdir(), "ulat-assign-"));
process.env.DATABASE_PATH = join(dir, "test.db");

// The real session code reads cookies through next/headers. The jar stands in
// for the request cookies, as in reports.test.ts.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));

const MAE = "8786102e-6b58-4104-9f32-79da5cd2672b";
const JUN = "9deec877-7d4f-41c0-b007-109e12ea254a";
const GONE = "1cc9e1ff-ee8d-43ea-9095-da04877d60d6";

const post = (code: string, body: unknown) => [
  new Request(`http://hub/api/reports/${code}/assign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }),
  { params: Promise.resolve({ code }) },
] as const;

describe("POST /api/reports/[code]/assign", () => {
  let route: typeof import("./route");
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let session: typeof import("@/lib/auth/session");
  let bus: typeof import("@/lib/live/bus");

  const signIn = async (who: "staff" | "responder" | null) => {
    jar.clear();
    if (!who) return;
    const secret = await session.getSessionSecret();
    const exp = session.sessionExpiry();
    if (who === "staff") jar.set(session.SESSION_COOKIE.staff, session.signSession({ role: "staff", exp }, secret));
    else jar.set(session.SESSION_COOKIE.responder, session.signSession({ role: "responder", responder_id: MAE, name: "Mae Santos", exp }, secret));
  };

  const addReport = (code: string, status: "waiting" | "visited" | "merged" | "cant_assess" = "waiting") => {
    const now = new Date().toISOString();
    db.insert(schema.reports)
      .values({
        code,
        source: "family",
        household_head: "Reyes household",
        barangay: "Santa Cruz",
        status,
        cant_reason: status === "cant_assess" ? "cant_find" : null,
        created_at: now,
        updated_at: now,
      })
      .run();
  };
  const row = (code: string) => db.select().from(schema.reports).where(eq(schema.reports.code, code)).get()!;

  beforeAll(async () => {
    const sqlite = new Database(process.env.DATABASE_PATH!);
    schema = await import("@/db/schema");
    const push = await pushSQLiteSchema(schema as unknown as Record<string, unknown>, drizzle({ client: sqlite }) as never);
    sqlite.exec(push.statementsToExecute.join(String.fromCharCode(10)));
    sqlite.close();
    ({ db } = await import("@/db/client"));
    route = await import("./route");
    session = await import("@/lib/auth/session");
    bus = await import("@/lib/live/bus");
    db.insert(schema.responders)
      .values([
        { id: MAE, name: "Mae Santos", team: "A", active: true },
        { id: JUN, name: "Jun Reyes", team: "A", active: true },
        { id: GONE, name: "Carlo Mendoza", team: "B", active: false },
      ])
      .run();
  });

  beforeEach(() => jar.clear());

  it("is for staff only", async () => {
    addReport("T5H8");
    expect((await route.POST(...post("T5H8", { responder_id: MAE }))).status).toBe(401);
    await signIn("responder");
    expect((await route.POST(...post("T5H8", { responder_id: MAE }))).status).toBe(403);
    expect(row("T5H8").status).toBe("waiting");
  });

  it("validates the code and the body", async () => {
    await signIn("staff");
    expect((await route.POST(...post("T5H0", { responder_id: MAE }))).status).toBe(400);
    expect((await route.POST(...post("T5H8", { responder_id: "r1" }))).status).toBe(400);
    expect((await route.POST(...post("T5H8", "{not json"))).status).toBe(400);
    expect((await route.POST(...post("ZZZZ", { responder_id: MAE }))).status).toBe(404);
  });

  it("refuses an inactive responder", async () => {
    await signIn("staff");
    const res = await route.POST(...post("T5H8", { responder_id: GONE }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_responder" });
    expect(row("T5H8").assigned_to).toBeNull();
  });

  it("assigns, writes the audit row and tells the live streams", async () => {
    const heard: HubEvent[] = [];
    const stop = bus.subscribe({ role: "staff" }, (event) => heard.push(event));
    await signIn("staff");

    const res = await route.POST(...post("t5h8", { responder_id: MAE }));
    stop();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: "T5H8", status: "assigned", assigned_to: MAE });
    expect(row("T5H8")).toMatchObject({ status: "assigned", assigned_to: MAE });
    expect(heard).toEqual([{ type: "report.updated", code: "T5H8", status: "assigned" }]);

    const audit = db
      .select()
      .from(schema.events)
      .where(and(eq(schema.events.entity_id, row("T5H8").id), eq(schema.events.type, "report.status_changed")))
      .all();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor: "staff", data: { status: "assigned", responder_id: MAE, from: "waiting" } });
  });

  it("can send someone else", async () => {
    await signIn("staff");
    expect((await route.POST(...post("T5H8", { responder_id: JUN }))).status).toBe(200);
    expect(row("T5H8").assigned_to).toBe(JUN);
  });

  it("clears the reason when a report that could not be assessed is sent again", async () => {
    addReport("J2V8", "cant_assess");
    await signIn("staff");
    expect((await route.POST(...post("J2V8", { responder_id: JUN }))).status).toBe(200);
    expect(row("J2V8")).toMatchObject({ status: "assigned", cant_reason: null });
  });

  it("leaves visited and merged reports alone", async () => {
    addReport("K7P4", "visited");
    addReport("M2Q9", "merged");
    await signIn("staff");
    expect((await route.POST(...post("K7P4", { responder_id: MAE }))).status).toBe(409);
    expect((await route.POST(...post("M2Q9", { responder_id: MAE }))).status).toBe(409);
    expect(row("K7P4")).toMatchObject({ status: "visited", assigned_to: null });
  });
});
