// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { pushSQLiteSchema } from "drizzle-kit/api";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { REPORT_CODE_ALPHABET, ReportCode, ReportStatusView } from "@/lib/contracts";
import { randomCode } from "./_lib/code";

const dir = mkdtempSync(join(tmpdir(), "ulat-reports-"));
process.env.DATABASE_PATH = join(dir, "test.db");

// The real session code reads cookies through next/headers. The jar stands in
// for the request cookies and holds tokens signed with the real secret.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));

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
  needs: ["water", "tarp"],
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
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const list = (query = "") => new Request(`http://hub/api/reports${query}`);
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });

describe("report codes", () => {
  it("uses only the safe alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const code = randomCode();
      expect(ReportCode.safeParse(code).success).toBe(true);
      expect([...code].every((c) => REPORT_CODE_ALPHABET.includes(c))).toBe(true);
    }
  });
});

describe("reports API", () => {
  let route: typeof import("./route");
  let one: typeof import("./[code]/route");
  let code: typeof import("./_lib/code");
  let auditLib: typeof import("./_lib/audit");
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let session: typeof import("@/lib/auth/session");

  // Signs in as staff or as the responder r1, or as nobody.
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
    one = await import("./[code]/route");
    code = await import("./_lib/code");
    auditLib = await import("./_lib/audit");
    session = await import("@/lib/auth/session");
    db.insert(schema.responders).values({ id: "r1", name: "Mae Santos", team: "A", active: true }).run();
  });

  // Families are not signed in, and every test starts that way. Staff-only
  // tests sign in themselves, and the list tests sign in as staff.
  beforeEach(() => jar.clear());

  const create = async (extra: object = {}) => {
    const res = await route.POST(post(report(extra)));
    return { res, code: ((await res.json()) as { code: string }).code };
  };
  const row = (c: string) => db.select().from(schema.reports).where(eq(schema.reports.code, c)).get()!;
  const view = async (c: string) => ReportStatusView.parse(await (await one.GET(new Request("http://hub"), ctx(c))).json());

  it("validates the body", async () => {
    expect((await route.POST(post("{not json"))).status).toBe(400);
    expect((await route.POST(post(report({ consent: false })))).status).toBe(400);
    expect((await route.POST(post(report({ household_head: "" })))).status).toBe(400);
    expect((await route.POST(post(report({ needs: ["gold"] })))).status).toBe(400);
    expect((await route.POST(post(report({ people: -1 })))).status).toBe(400);
  });

  it("turns away a body over the cap before reading it", async () => {
    const reports = () => db.select().from(schema.reports).all().length;
    const before = reports();
    const junk = JSON.stringify({ ...report(), junk: "x".repeat(100 * 1024) });

    // The header says it is too big, so none of the body is read.
    const declared = new Request("http://hub/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(junk.length) },
      body: junk,
    });
    const res = await route.POST(declared);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });

    // No content-length, as in a chunked request. The read stops at the cap.
    let pulled = 0;
    const chunk = new TextEncoder().encode("x".repeat(8 * 1024));
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled <= 1000) controller.enqueue(chunk);
        else controller.close();
      },
    });
    const chunked = new Request("http://hub/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect((await route.POST(chunked)).status).toBe(413);
    expect(pulled).toBeLessThan(20);

    expect(reports()).toBe(before);
  });

  it("still saves the longest honest report", async () => {
    const { res } = await create({
      reporter_name: "n".repeat(120),
      reporter_where: "w".repeat(120),
      what_happened: "h".repeat(200),
      transcript: "é".repeat(2000),
      english: "e".repeat(2000),
      needs: ["water", "food", "tarp", "medicine", "hygiene_kit", "baby_needs"],
    });
    expect(res.status).toBe(201);
  });

  it("saves a family report, returns a code and writes the audit row", async () => {
    const { res, code: c } = await create();
    expect(res.status).toBe(201);
    expect(ReportCode.safeParse(c).success).toBe(true);
    const saved = row(c);
    expect(saved).toMatchObject({ status: "waiting", source: "family", needs: ["water", "tarp"], transcript_en: "The roof is gone" });
    const trail = db.select().from(schema.events).where(eq(schema.events.entity_id, saved.id)).all();
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({ entity: "report", type: "report.created", actor: "family" });
  });

  it("lets only staff file a desk report", async () => {
    expect((await create({ source: "desk" })).res.status).toBe(401);
    await signIn("responder");
    expect((await create({ source: "desk" })).res.status).toBe(403);
    await signIn("staff");
    const { res, code: c } = await create({ source: "desk" });
    expect(res.status).toBe(201);
    const trail = db.select().from(schema.events).where(eq(schema.events.entity_id, row(c).id)).all();
    expect(trail[0].actor).toBe("staff");
  });

  it("retries when a code is taken, and gives up rather than loop", async () => {
    const { code: taken } = await create();
    const tries = [taken, taken, "ZZ99"];
    expect(code.freshCode(db, () => tries.shift()!)).toBe("ZZ99");
    expect(() => code.freshCode(db, () => taken)).toThrow("no_free_report_code");
  });

  it("gives a family the minimal view and nothing else", async () => {
    const { code: c } = await create({ hurt: 2, reporter_name: "Ana", reporter_where: "Chapel" });
    const res = await one.GET(new Request("http://hub"), ctx(c.toLowerCase()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ["barangay", "code", "confirmed_by", "household_head", "purok", "result", "steps", "urgent"].sort(),
    );
    const v = ReportStatusView.parse(body);
    expect(v.urgent).toBe(true);
    expect(v.steps.map((s) => s.step)).toEqual(["received", "on_the_way", "visited", "confirmed"]);
    expect(v.steps[0].at).toBe(row(c).created_at);
    expect(v.steps.slice(1).every((s) => s.at === null)).toBe(true);
    expect(v.result).toBeNull();
  });

  it("answers 400 for a bad code and 404 for an unknown one", async () => {
    expect((await one.GET(new Request("http://hub"), ctx("O0I1"))).status).toBe(400);
    expect((await one.GET(new Request("http://hub"), ctx("TOOLONG"))).status).toBe(400);
    expect((await one.GET(new Request("http://hub"), ctx("ZZZ9"))).status).toBe(404);
  });

  it("fills the timeline from status changes and the confirmed entry", async () => {
    const { code: c } = await create();
    const saved = row(c);
    const event = auditLib.setStatus(db, saved, "on_the_way", "r1", { assigned_to: "r1" });
    expect(event).toEqual({ type: "report.updated", code: c, status: "on_the_way" });
    expect(row(c)).toMatchObject({ status: "on_the_way", assigned_to: "r1" });
    expect((await view(c)).steps[1].at).not.toBeNull();

    db.insert(schema.entries)
      .values({
        number: 1,
        report_id: saved.id,
        responder_id: "r1",
        barangay: saved.barangay,
        damage_class: "total",
        status: "confirmed",
        confirmed_by: "r1",
        confirmed_at: "2026-10-09T06:48:00.000Z",
        created_at: "2026-10-09T06:46:00.000Z",
      })
      .run();
    const v = await view(c);
    expect(v.steps[2].at).toBe("2026-10-09T06:46:00.000Z");
    expect(v.steps[3].at).toBe("2026-10-09T06:48:00.000Z");
    expect(v.result).toBe("total");
    expect(v.confirmed_by).toBe("Mae Santos");
  });

  it("publishes report.created to the live bus after the write", async () => {
    const { subscribe } = await import("@/lib/live/bus");
    const seen: unknown[] = [];
    const stop = subscribe({ role: "staff" }, (event) => seen.push(event));
    const { code: c } = await create({ hurt: 1 });
    stop();
    expect(seen).toEqual([{ type: "report.created", code: c, urgent: true }]);
  });

  it("keeps the list behind the PIN", async () => {
    expect((await route.GET(list())).status).toBe(401);
    await signIn("responder");
    expect((await route.GET(list())).status).toBe(200);
    await signIn("staff");
    expect((await route.GET(list("?per_page=1000"))).status).toBe(400);
    expect((await route.GET(list("?status=lost"))).status).toBe(400);
  });

  it("lists urgent first, then oldest, and hides merged reports", async () => {
    await signIn("staff");
    const { code: merged } = await create({ household_head: "Merged one" });
    auditLib.setStatus(db, row(merged), "merged", "staff");
    const body = (await (await route.GET(list("?per_page=100"))).json()) as {
      items: { code: string; urgent: boolean; created_at: string }[];
      total: number;
    };
    expect(body.total).toBe(body.items.length);
    expect(body.items.some((r) => r.code === merged)).toBe(false);
    const firstCalm = body.items.findIndex((r) => !r.urgent);
    expect(firstCalm).toBeGreaterThan(0);
    expect(body.items.slice(firstCalm).every((r) => !r.urgent)).toBe(true);
    const calm = body.items.slice(firstCalm).map((r) => r.created_at);
    expect(calm).toEqual([...calm].sort());

    const only = (await (await route.GET(list("?status=merged"))).json()) as { items: { code: string }[] };
    expect(only.items.map((r) => r.code)).toEqual([merged]);
  });

  it("searches for % and _ as plain text", async () => {
    await signIn("staff");
    const { code: plain } = await create({ household_head: "Plain Name" });
    const { code: odd } = await create({ household_head: "100%_done" });
    const ids = async (q: string) =>
      ((await (await route.GET(list(`?per_page=100&q=${encodeURIComponent(q)}`))).json()) as { items: { code: string }[] }).items.map(
        (r) => r.code,
      );
    expect(await ids("%")).toEqual([odd]);
    expect(await ids("_")).toEqual([odd]);
    expect(await ids("0%_d")).toEqual([odd]);
    expect(await ids("plain")).toEqual([plain]);
  });

  it("filters by barangay and search", async () => {
    await signIn("staff");
    const { code: c } = await create({ barangay: "Mabini", household_head: "Reyes" });
    const byBarangay = (await (await route.GET(list("?barangay=Mabini"))).json()) as { items: { code: string }[] };
    expect(byBarangay.items.map((r) => r.code)).toEqual([c]);
    const byName = (await (await route.GET(list("?q=reyes"))).json()) as { items: { code: string }[] };
    expect(byName.items.map((r) => r.code)).toEqual([c]);
    const byCode = (await (await route.GET(list(`?q=${c.toLowerCase()}`))).json()) as { items: { code: string }[] };
    expect(byCode.items.map((r) => r.code)).toContain(c);
  });
});
