// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { pushSQLiteSchema } from "drizzle-kit/api";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { reviewReasons } from "./_lib/review";

const dir = mkdtempSync(join(tmpdir(), "ulat-entries-"));
process.env.DATABASE_PATH = join(dir, "test.db");
process.env.UPLOAD_DIR = join(dir, "uploads");

// The real session reads a cookie through next/headers. Here the "cookie" is
// the x-test-role header of the request being built: the Request class below
// records it as the current session just before each call.
const session = vi.hoisted(() => ({ role: null as "responder" | "staff" | null }));
const denied = () => Response.json({ error: "unauthorized" }, { status: 401 });
const asResponder = () => ({ role: "responder", responder_id: "r1", name: "Ana", exp: Date.now() + 1000 });
const asStaff = () => ({ role: "staff", exp: Date.now() + 1000 });
vi.mock("@/lib/auth/session", () => ({
  requireResponder: async () => (session.role === "responder" ? asResponder() : denied()),
  requireStaff: async () => (session.role === "staff" ? asStaff() : denied()),
  requireResponderOrStaff: async () =>
    session.role === "responder" ? asResponder() : session.role === "staff" ? asStaff() : denied(),
}));

class TestRequest extends Request {
  constructor(input: string, init?: RequestInit) {
    super(input, init);
    session.role = (new Headers(init?.headers).get("x-test-role") as "responder" | "staff" | null) ?? null;
  }
}

const staff = { "x-test-role": "staff" };
const resp = { "x-test-role": "responder" };
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

// What the assess screen sends: the house, the photo labels and the responder's answers.
const meta = (extra: object = {}) =>
  JSON.stringify({
    report_code: null,
    barangay: "Poblacion",
    purok: "Purok 2",
    household_head: "Dela Cruz",
    lat: 10.1,
    lng: 123.2,
    gps_accuracy_m: 8,
    photo_labels: ["front", "roof"],
    damage_class: "partial",
    material: "mixed",
    hazards: [],
    families: 1,
    people: 4,
    hurt: 0,
    missing: 0,
    needs: ["water"],
    ...extra,
  });

function postForm(photos = 2, extra: object = {}, headers: Record<string, string> = resp) {
  const form = new FormData();
  form.set("meta", meta(extra));
  for (let i = 0; i < photos; i++) form.append("photos", new File([PNG], `p${i}.png`, { type: "image/png" }));
  return new TestRequest("http://hub/api/entries", { method: "POST", body: form, headers });
}


const patch = (id: string, body: unknown, headers: Record<string, string> = staff) =>
  new TestRequest(`http://hub/api/entries/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const confirmBody = (extra: object = {}) => ({
  damage_class: "partial",
  material: "mixed",
  hazards: [],
  families: 1,
  people: 4,
  hurt: 0,
  missing: 0,
  needs: ["water"],
  ...extra,
});
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("review rules", () => {
  it("passes when the hurt count matches the report, or there is no report", () => {
    expect(reviewReasons({ confirm: { hurt: 1 }, reportHurt: 1 })).toEqual([]);
    expect(reviewReasons({ confirm: { hurt: 3 }, reportHurt: null })).toEqual([]);
  });
  it("flags a hurt count that differs from the report", () => {
    expect(reviewReasons({ confirm: { hurt: 2 }, reportHurt: 1 })).toEqual(["hurt_differs"]);
  });
});

describe("entries API", () => {
  let entries: typeof import("./route");
  let one: typeof import("./[id]/route");
  let files: typeof import("../files/[id]/route");
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");

  beforeAll(async () => {
    const sqlite = new Database(process.env.DATABASE_PATH!);
    schema = await import("@/db/schema");
    const push = await pushSQLiteSchema(schema as unknown as Record<string, unknown>, drizzle({ client: sqlite }) as never);
    sqlite.exec(push.statementsToExecute.join(String.fromCharCode(10)));
    sqlite.close();
    ({ db } = await import("@/db/client"));
    entries = await import("./route");
    one = await import("./[id]/route");
    files = await import("../files/[id]/route");
    db.insert(schema.responders).values({ id: "r1", name: "Ana", team: "A", active: true }).run();
  });

  const create = async (photos = 2, extra: object = {}) => {
    const res = await entries.POST(postForm(photos, extra));
    return { res, body: (await res.json()) as { id: string; number: number; status: string; reasons: string[] } };
  };
  const row = (id: string) => db.select().from(schema.entries).where(eq(schema.entries.id, id)).get()!;
  const history = async (id: string) =>
    ((await (await one.GET(new TestRequest("http://hub", { headers: staff }), ctx(id))).json()).history as { type: string }[]).map((h) => h.type);

  it("refuses without a session and for families", async () => {
    expect((await entries.POST(postForm(1, {}, {}))).status).toBe(401);
    expect((await entries.POST(postForm(1, {}, staff))).status).toBe(401);
    expect((await entries.GET(new TestRequest("http://hub/api/entries", { headers: resp }))).status).toBe(401);
  });

  it("validates the form, and needs a class the responder picked", async () => {
    expect((await entries.POST(postForm(0))).status).toBe(400);
    expect((await entries.POST(postForm(4))).status).toBe(400);
    expect((await entries.POST(postForm(1, { barangay: "" }))).status).toBe(400);
    expect((await entries.POST(postForm(1, { damage_class: undefined }))).status).toBe(400);
    expect((await entries.POST(postForm(1, { damage_class: "unclear" }))).status).toBe(400);
    const bad = new FormData();
    bad.set("meta", meta());
    bad.append("photos", new File(["x"], "x.exe", { type: "application/x-msdownload" }));
    const res = await entries.POST(new TestRequest("http://hub/api/entries", { method: "POST", body: bad, headers: resp }));
    expect(res.status).toBe(400);
  });

  it("confirms on create, stores the photos and audit rows, and runs no AI", async () => {
    const { res, body } = await create(2);
    expect(res.status).toBe(201);
    expect(body).toMatchObject({ status: "confirmed", reasons: [] });
    expect(body.number).toBeGreaterThan(0);
    expect(row(body.id)).toMatchObject({ status: "confirmed", damage_class: "partial", people: 4, needs: ["water"], confirmed_by: "r1" });
    expect(await history(body.id)).toEqual(["entry.created", "entry.confirmed"]);

    const detail = await (await one.GET(new TestRequest("http://hub", { headers: staff }), ctx(body.id))).json();
    expect(detail.ai).toBeUndefined();
    expect(detail.photos).toHaveLength(2);
    expect(detail.photos[0].path).toMatch(/^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.png$/);
    const file = await files.GET(new TestRequest("http://hub", { headers: resp }), ctx(detail.photos[0].id));
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/png");
    expect((await files.GET(new TestRequest("http://hub"), ctx(detail.photos[0].id))).status).toBe(401);
    expect((await files.GET(new TestRequest("http://hub", { headers: resp }), ctx("nope"))).status).toBe(404);
  });

  it("lists a confirmed entry for the hub", async () => {
    await create(2);
    const list = await (await entries.GET(new TestRequest("http://hub/api/entries?q=Dela&per_page=1", { headers: staff }))).json();
    expect(list.total).toBeGreaterThan(0);
    expect(list.items).toHaveLength(1);
    expect(list.items[0].status).toBe("confirmed");
    const none = await (await entries.GET(new TestRequest("http://hub/api/entries?damage_class=none", { headers: staff }))).json();
    expect(none.total).toBe(0);
  });

  describe("a house with a family report", () => {
    const addReport = (id: string, code: string, extra: object = {}) => {
      const now = new Date().toISOString();
      db.insert(schema.reports)
        .values({ id, code, source: "family", household_head: "Santos", barangay: "Poblacion", people: 5, hurt: 1, missing: 0, needs: ["water"], status: "assigned", created_at: now, updated_at: now, ...extra })
        .run();
    };
    const report = (id: string) => db.select().from(schema.reports).where(eq(schema.reports.id, id)).get()!;

    it("saves what the responder sent and marks the report visited", async () => {
      addReport("rep-visit", "ABCD");
      const { body } = await create(2, { report_code: "ABCD", people: 6, hurt: 1, damage_class: "total" });
      expect(body.status).toBe("confirmed");
      expect(row(body.id)).toMatchObject({ report_id: "rep-visit", people: 6, hurt: 1, damage_class: "total" });
      expect(report("rep-visit").status).toBe("visited");
      // The family timeline reads report.status_changed, so that is the row it writes.
      const rows = db.select().from(schema.events).where(eq(schema.events.entity_id, "rep-visit")).all();
      expect(rows.map((r) => r.type)).toEqual(["report.status_changed"]);
      expect(rows[0]).toMatchObject({ actor: "r1", data: { status: "visited", entry_id: body.id } });
    });

    it("holds a different hurt count for a second look, and staff settle it", async () => {
      addReport("rep-hurt", "HJKM");
      const { body } = await create(2, { report_code: "HJKM", hurt: 0 });
      expect(body).toMatchObject({ status: "needs_review", reasons: ["hurt_differs"] });
      expect(row(body.id)).toMatchObject({ status: "needs_review", confirmed_by: null, review_reason: "The hurt count is different from the family report." });
      expect(await history(body.id)).toEqual(["entry.created", "entry.needs_review"]);
      expect(report("rep-hurt").status).toBe("assigned");
      const listed = await (await entries.GET(new TestRequest("http://hub/api/entries?q=" + body.number, { headers: staff }))).json();
      expect(listed.total).toBe(0);

      const settled = await (await one.PATCH(patch(body.id, confirmBody({ hurt: 0 })), ctx(body.id))).json();
      expect(settled.status).toBe("confirmed");
      expect(row(body.id)).toMatchObject({ status: "confirmed", confirmed_by: "staff", review_reason: null });
      expect(report("rep-hurt").status).toBe("visited");
    });

    it("does not reopen a merged report", async () => {
      addReport("rep-merged", "MNPQ", { status: "merged" });
      await create(2, { report_code: "MNPQ", hurt: 1 });
      expect(report("rep-merged").status).toBe("merged");
    });

    it("refuses a report code the hub does not have", async () => {
      expect((await entries.POST(postForm(1, { report_code: "ZZZZ" }))).status).toBe(404);
    });
  });

  it("lets only staff patch an entry", async () => {
    const { body } = await create(2);
    const before = row(body.id);
    expect((await one.PATCH(patch(body.id, confirmBody({ damage_class: "none" }), resp), ctx(body.id))).status).toBe(401);
    expect((await one.PATCH(patch(body.id, confirmBody({ damage_class: "none" }), {}), ctx(body.id))).status).toBe(401);
    expect(row(body.id)).toEqual(before);
  });

  describe("files of a refused upload", () => {
    const stored = () => (readdirSync(process.env.UPLOAD_DIR!, { recursive: true }) as string[]).filter((f) => /\.\w+$/.test(f)).length;
    const withNote = (note: File) => {
      const form = new FormData();
      form.set("meta", meta());
      for (let i = 0; i < 2; i++) form.append("photos", new File([PNG], `p${i}.png`, { type: "image/png" }));
      form.set("note", note);
      return new TestRequest("http://hub/api/entries", { method: "POST", body: form, headers: resp });
    };

    it("deletes the photos already stored when the note is refused", async () => {
      await create(1);
      const before = stored();
      const res = await entries.POST(withNote(new File(["x"], "note.exe", { type: "application/x-msdownload" })));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "audio_type_not_allowed" });
      expect(stored()).toBe(before);
    });

    it("deletes the earlier photos when a later photo is refused", async () => {
      const before = stored();
      const form = new FormData();
      form.set("meta", meta());
      form.append("photos", new File([PNG], "ok.png", { type: "image/png" }));
      form.append("photos", new File(["x"], "bad.exe", { type: "application/x-msdownload" }));
      const res = await entries.POST(new TestRequest("http://hub/api/entries", { method: "POST", body: form, headers: resp }));
      expect(res.status).toBe(400);
      expect(stored()).toBe(before);
    });

    it("keeps the files of a note that is accepted", async () => {
      const before = stored();
      const res = await entries.POST(withNote(new File([PNG], "note.webm", { type: "audio/webm" })));
      expect(res.status).toBe(201);
      expect(stored()).toBe(before + 3);
    });
  });

  describe("client_id", () => {
    const onDisk = () =>
      existsSync(process.env.UPLOAD_DIR!)
        ? (readdirSync(process.env.UPLOAD_DIR!, { recursive: true }) as string[]).filter((f) => /\.\w+$/.test(f)).length
        : 0;
    const rowsFor = (client_id: string) => db.select().from(schema.entries).where(eq(schema.entries.client_id, client_id)).all();
    const trail = (id: string) => db.select().from(schema.events).where(eq(schema.events.entity_id, id)).all().map((e) => e.type);

    it("returns the same entry with 200 for a repeat, and stores no files and no audit rows again", async () => {
      const client_id = "3f6c2a1e-9b0d-4c55-8a7e-1d2f3a4b5c6d";
      const first = await entries.POST(postForm(2, { client_id }));
      const filesAfterFirst = onDisk();
      const again = await entries.POST(postForm(2, { client_id }));
      const body = await again.json();

      expect(first.status).toBe(201);
      expect(again.status).toBe(200);
      expect(body.id).toBe((await first.json()).id);
      expect(body).toMatchObject({ status: "confirmed", entry: { id: body.id, client_id } });
      expect(rowsFor(client_id)).toHaveLength(1);
      expect(onDisk()).toBe(filesAfterFirst);
      expect(db.select().from(schema.photos).where(eq(schema.photos.entry_id, body.id)).all()).toHaveLength(2);
      expect(trail(body.id)).toEqual(["entry.created", "entry.confirmed"]);
    });

    it("makes one entry and one set of files for two requests at once, and neither is a 500", async () => {
      const client_id = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
      const before = onDisk();
      const [a, b] = await Promise.all([entries.POST(postForm(2, { client_id })), entries.POST(postForm(2, { client_id }))]);
      const [x, y] = [await a.json(), await b.json()];

      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(x.id).toBe(y.id);
      expect(rowsFor(client_id)).toHaveLength(1);
      expect(onDisk()).toBe(before + 2);
      expect(db.select().from(schema.photos).where(eq(schema.photos.entry_id, x.id)).all()).toHaveLength(2);
      expect(trail(x.id)).toEqual(["entry.created", "entry.confirmed"]);
    });

    it("keeps different client_ids apart, and entries without one never collide", async () => {
      const a = await create(1, { client_id: "11111111-2222-4333-8444-555555555555" });
      const b = await create(1, { client_id: "66666666-7777-4888-8999-000000000000" });
      expect(a.res.status).toBe(201);
      expect(b.res.status).toBe(201);
      expect(a.body.id).not.toBe(b.body.id);
      const [c, d] = [await create(1), await create(1)];
      expect([c.res.status, d.res.status]).toEqual([201, 201]);
      expect(c.body.id).not.toBe(d.body.id);
    });

    it("refuses a client_id that is not a uuid", async () => {
      expect((await entries.POST(postForm(1, { client_id: "not-a-uuid" }))).status).toBe(400);
    });

    it("answers 409 and shows nothing for a client_id another responder used", async () => {
      const client_id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
      db.insert(schema.responders).values({ id: "r3", name: "Cris", team: "C", active: true }).run();
      db.insert(schema.entries)
        .values({ id: "other-entry", number: 9001, responder_id: "r3", barangay: "Poblacion", damage_class: "partial", status: "confirmed", client_id, created_at: new Date().toISOString() })
        .run();
      const before = onDisk();
      const res = await entries.POST(postForm(1, { client_id }));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "client_id_taken" });
      expect(onDisk()).toBe(before);
      expect(rowsFor(client_id)).toHaveLength(1);
    });
  });

});
