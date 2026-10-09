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
process.env.MOCK_AI = "1";

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
    ...extra,
  });

function postForm(photos = 2, extra: object = {}, headers: Record<string, string> = resp) {
  const form = new FormData();
  form.set("meta", meta(extra));
  for (let i = 0; i < photos; i++) form.append("photos", new File([PNG], `p${i}.png`, { type: "image/png" }));
  return new TestRequest("http://hub/api/entries", { method: "POST", body: form, headers });
}

// The mock AI says total for two photos and unclear for one.
const confirmBody = (extra: object = {}) => ({
  damage_class: "total",
  material: "mixed",
  hazards: [],
  families: 1,
  people: 4,
  hurt: 0,
  missing: 0,
  needs: ["water"],
  new_photo_since_unclear: false,
  ...extra,
});
const patch = (id: string, body: unknown, headers: Record<string, string> = resp) =>
  new TestRequest(`http://hub/api/entries/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
function photoForm(label = "roof", headers: Record<string, string> = resp) {
  const form = new FormData();
  form.set("photo", new File([PNG], "extra.png", { type: "image/png" }));
  form.set("label", label);
  return new TestRequest("http://hub/api/entries/x/photos", { method: "POST", body: form, headers });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("review rules", () => {
  const base = { damage_class: "partial", hurt: 0 } as const;
  const none = { hasNewPhoto: false };
  it("passes when everything agrees", () => {
    expect(reviewReasons({ aiClass: "partial", confirm: base, ...none, reportHurt: 0 })).toEqual([]);
  });
  it("flags a different class", () => {
    expect(reviewReasons({ aiClass: "total", confirm: base, ...none, reportHurt: null })).toEqual(["class_differs"]);
  });
  it("flags unclear without a new photo, and accepts one with a new photo", () => {
    expect(reviewReasons({ aiClass: "unclear", confirm: base, ...none, reportHurt: null })).toEqual(["unclear_no_new_photo"]);
    expect(reviewReasons({ aiClass: "unclear", confirm: base, hasNewPhoto: true, reportHurt: null })).toEqual([]);
  });
  it("treats a draft the AI has not finished like unclear", () => {
    expect(reviewReasons({ aiClass: null, confirm: base, ...none, reportHurt: null })).toEqual(["unclear_no_new_photo"]);
    expect(reviewReasons({ aiClass: null, confirm: base, hasNewPhoto: true, reportHurt: null })).toEqual([]);
  });
  it("flags a hurt count that differs from the report", () => {
    expect(reviewReasons({ aiClass: "partial", confirm: { ...base, hurt: 2 }, ...none, reportHurt: 1 })).toEqual(["hurt_differs"]);
  });
});

describe("entries API", () => {
  let entries: typeof import("./route");
  let one: typeof import("./[id]/route");
  let photosRoute: typeof import("./[id]/photos/route");
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
    photosRoute = await import("./[id]/photos/route");
    files = await import("../files/[id]/route");
    db.insert(schema.responders).values({ id: "r1", name: "Ana", team: "A", active: true }).run();
  });

  const create = async (photos = 2, extra: object = {}) => {
    const res = await entries.POST(postForm(photos, extra));
    return { res, body: (await res.json()) as { id: string; number: number; entry: { ai_class: string | null } } };
  };

  it("refuses without a session and for families", async () => {
    expect((await entries.POST(postForm(1, {}, {}))).status).toBe(401);
    expect((await entries.POST(postForm(1, {}, staff))).status).toBe(401);
    expect((await entries.GET(new TestRequest("http://hub/api/entries", { headers: resp }))).status).toBe(401);
  });

  it("validates the form", async () => {
    expect((await entries.POST(postForm(0))).status).toBe(400);
    expect((await entries.POST(postForm(4))).status).toBe(400);
    expect((await entries.POST(postForm(1, { barangay: "" }))).status).toBe(400);
    const bad = new FormData();
    bad.set("meta", meta());
    bad.append("photos", new File(["x"], "x.exe", { type: "application/x-msdownload" }));
    const res = await entries.POST(new TestRequest("http://hub/api/entries", { method: "POST", body: bad, headers: resp }));
    expect(res.status).toBe(400);
  });

  it("creates a draft, stores the photos and audit rows, and runs the AI draft", async () => {
    const { res, body } = await create(2);
    expect(res.status).toBe(201);
    expect(body.number).toBeGreaterThan(0);
    const detail = await (await one.GET(new TestRequest("http://hub", { headers: staff }), ctx(body.id))).json();
    expect(detail.entry.status).toBe("draft");
    expect(detail.photos).toHaveLength(2);
    expect(detail.photos[0].path).toMatch(/^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(detail.entry.ai_class).toBe("total");
    expect(detail.history.map((h: { type: string }) => h.type)).toEqual(["entry.created", "ai.photo"]);

    const file = await files.GET(new TestRequest("http://hub", { headers: resp }), ctx(detail.photos[0].id));
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/png");
    expect((await files.GET(new TestRequest("http://hub"), ctx(detail.photos[0].id))).status).toBe(401);
    expect((await files.GET(new TestRequest("http://hub", { headers: resp }), ctx("nope"))).status).toBe(404);
  });

  it("confirms, records changed fields, and lists it for the hub", async () => {
    const { body } = await create(2);
    const res = await one.PATCH(patch(body.id, confirmBody()), ctx(body.id));
    expect((await res.json()).status).toBe("confirmed");
    const detail = await (await one.GET(new TestRequest("http://hub", { headers: staff }), ctx(body.id))).json();
    const changed = detail.history.filter((h: { type: string }) => h.type === "entry.field_changed").map((h: { data: { field: string } }) => h.data.field);
    expect(changed).toEqual(expect.arrayContaining(["damage_class", "people", "needs"]));
    expect(detail.history.at(-1).type).toBe("entry.confirmed");

    const list = await (await entries.GET(new TestRequest("http://hub/api/entries?q=Dela&per_page=1", { headers: staff }))).json();
    expect(list.total).toBeGreaterThan(0);
    expect(list.items).toHaveLength(1);
    expect(list.items[0].status).toBe("confirmed");
    const none = await (await entries.GET(new TestRequest("http://hub/api/entries?damage_class=none", { headers: staff }))).json();
    expect(none.total).toBe(0);
  });

  it("sends a different class to needs_review, and staff can settle it", async () => {
    const { body } = await create(2);
    const res = await (await one.PATCH(patch(body.id, confirmBody({ damage_class: "partial" })), ctx(body.id))).json();
    expect(res.status).toBe("needs_review");
    expect(res.reasons).toEqual(["class_differs"]);
    const listed = await (await entries.GET(new TestRequest("http://hub/api/entries?q=" + body.number, { headers: staff }))).json();
    expect(listed.total).toBe(0);
    const settled = await (await one.PATCH(patch(body.id, confirmBody({ damage_class: "partial" }), staff), ctx(body.id))).json();
    expect(settled.status).toBe("confirmed");
  });

  it("sends an unclear draft without a new photo to needs_review", async () => {
    const { body } = await create(1);
    expect(body.entry.ai_class).toBe("unclear");
    const res = await (await one.PATCH(patch(body.id, confirmBody()), ctx(body.id))).json();
    expect(res.reasons).toEqual(["unclear_no_new_photo"]);
  });

  it("ignores new_photo_since_unclear from the phone", async () => {
    const { body } = await create(1);
    const claimed = await (await one.PATCH(patch(body.id, confirmBody({ new_photo_since_unclear: true })), ctx(body.id))).json();
    expect(claimed.reasons).toEqual(["unclear_no_new_photo"]);
  });

  it("counts an unclear draft as met once a photo was added through the route", async () => {
    const { body } = await create(1);
    expect(body.entry.ai_class).toBe("unclear");
    expect((await photosRoute.POST(photoForm(), ctx(body.id))).status).toBe(201);
    const ok = await (await one.PATCH(patch(body.id, confirmBody({ new_photo_since_unclear: false })), ctx(body.id))).json();
    expect(ok.status).toBe("confirmed");
  });

  describe("POST /api/entries/[id]/photos", () => {
    it("adds a photo, writes entry.photo_added with the actor, and drafts again", async () => {
      const { body } = await create(1);
      const res = await photosRoute.POST(photoForm("roof"), ctx(body.id));
      expect(res.status).toBe(201);
      const out = await res.json();
      expect(out.photos).toBe(2);
      // The mock AI says total for two photos.
      expect(out.entry.ai_class).toBe("total");
      const detail = await (await one.GET(new TestRequest("http://hub", { headers: staff }), ctx(body.id))).json();
      expect(detail.photos).toHaveLength(2);
      expect(detail.photos[1].label).toBe("roof");
      const added = detail.history.find((h: { type: string }) => h.type === "entry.photo_added");
      expect(added.actor).toBe("r1");
      expect(detail.history.filter((h: { type: string }) => h.type === "ai.photo")).toHaveLength(2);
    });

    it("refuses a fourth photo", async () => {
      const { body } = await create(3);
      const res = await photosRoute.POST(photoForm(), ctx(body.id));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("photo_count");
    });

    it("refuses an entry that is not a draft, and one that does not exist", async () => {
      const { body } = await create(2);
      await one.PATCH(patch(body.id, confirmBody()), ctx(body.id));
      expect((await photosRoute.POST(photoForm(), ctx(body.id))).status).toBe(409);
      expect((await photosRoute.POST(photoForm(), ctx("nope"))).status).toBe(404);
    });

    it("is for responders only and validates the upload", async () => {
      const { body } = await create(1);
      expect((await photosRoute.POST(photoForm("roof", staff), ctx(body.id))).status).toBe(401);
      expect((await photosRoute.POST(photoForm("roof", {}), ctx(body.id))).status).toBe(401);
      const noFile = new FormData();
      noFile.set("label", "roof");
      const missing = new TestRequest("http://hub/x", { method: "POST", body: noFile, headers: resp });
      expect((await photosRoute.POST(missing, ctx(body.id))).status).toBe(400);
      const bad = new FormData();
      bad.set("photo", new File(["x"], "x.exe", { type: "application/x-msdownload" }));
      const wrongType = new TestRequest("http://hub/x", { method: "POST", body: bad, headers: resp });
      expect((await photosRoute.POST(wrongType, ctx(body.id))).status).toBe(400);
    });
  });

  it("sends a confirm that beats the AI draft to needs_review", async () => {
    const { body } = await create(2);
    db.update(schema.entries).set({ ai_class: null, ai_confidence: null, ai_reason: null, ai_need_more: null }).where(eq(schema.entries.id, body.id)).run();
    const res = await (await one.PATCH(patch(body.id, confirmBody({ damage_class: "none" })), ctx(body.id))).json();
    expect(res.status).toBe("needs_review");
    expect(res.reasons).toEqual(["unclear_no_new_photo"]);
  });

  describe("an entry started from a family report", () => {
    const addReport = (id: string, code: string, counts: { people: number; hurt: number; missing: number; needs: ("water" | "food")[] }) => {
      const now = new Date().toISOString();
      db.insert(schema.reports)
        .values({ id, code, source: "family", household_head: "Santos", barangay: "Poblacion", ...counts, status: "assigned", created_at: now, updated_at: now })
        .run();
    };
    const row = (id: string) => db.select().from(schema.entries).where(eq(schema.entries.id, id)).get();

    it("starts from the report's people, hurt, missing and needs, and the AI draft keeps them", async () => {
      addReport("rep-prefill", "PQRS", { people: 5, hurt: 1, missing: 2, needs: ["water", "food"] });
      const { body } = await create(2, { report_code: "PQRS" });
      // The mock draft has run by now and set the class, so this is the entry after drafting.
      expect(row(body.id)).toMatchObject({ ai_class: "total", people: 5, hurt: 1, missing: 2, needs: ["water", "food"], families: 1 });
    });

    it("keeps the report's counts when the draft fails and falls back to unclear", async () => {
      addReport("rep-unclear", "WXYZ", { people: 3, hurt: 1, missing: 0, needs: [] });
      const { body } = await create(1, { report_code: "WXYZ" });
      expect(body.entry.ai_class).toBe("unclear");
      expect(row(body.id)).toMatchObject({ people: 3, hurt: 1, missing: 0 });
    });

    it("confirms without edits: counted, not sent to review, and no count change logged", async () => {
      addReport("rep-confirm", "KLMN", { people: 5, hurt: 1, missing: 0, needs: ["water"] });
      const { body } = await create(2, { report_code: "KLMN" });
      const res = await (await one.PATCH(patch(body.id, confirmBody({ people: 5, hurt: 1, missing: 0, needs: ["water"] })), ctx(body.id))).json();
      expect(res.status).toBe("confirmed");
      const detail = await (await one.GET(new TestRequest("http://hub", { headers: staff }), ctx(body.id))).json();
      const changed = detail.history.filter((h: { type: string }) => h.type === "entry.field_changed").map((h: { data: { field: string } }) => h.data.field);
      expect(changed).not.toEqual(expect.arrayContaining(["people"]));
      expect(changed).not.toEqual(expect.arrayContaining(["hurt"]));
      const listed = await (await entries.GET(new TestRequest("http://hub/api/entries?q=" + body.number, { headers: staff }))).json();
      expect(listed.total).toBe(1);
    });

    it("still sends a changed hurt count to review", async () => {
      addReport("rep-hurt", "HJKM", { people: 5, hurt: 1, missing: 0, needs: [] });
      const { body } = await create(2, { report_code: "HJKM" });
      const res = await (await one.PATCH(patch(body.id, confirmBody({ people: 5, hurt: 0, needs: [] })), ctx(body.id))).json();
      expect(res.reasons).toEqual(["hurt_differs"]);
    });

    it("changes no report row, since only a confirmed entry may count", async () => {
      addReport("rep-same", "RTVW", { people: 5, hurt: 1, missing: 0, needs: ["food"] });
      const before = db.select().from(schema.reports).all().find((r) => r.id === "rep-same");
      await create(2, { report_code: "RTVW" });
      expect(db.select().from(schema.reports).all().find((r) => r.id === "rep-same")).toEqual(before);
    });
  });

  it("starts a house with no report from zero, as before", async () => {
    const { body } = await create(2);
    const saved = db.select().from(schema.entries).where(eq(schema.entries.id, body.id)).get();
    expect(saved).toMatchObject({ report_id: null, people: 0, hurt: 0, missing: 0, needs: [], families: 1 });
  });

  it("marks the linked report visited when confirmed", async () => {
    const now = new Date().toISOString();
    db.insert(schema.reports)
      .values({
        id: "rep1", code: "ABCD", source: "family", household_head: "Dela Cruz", barangay: "Poblacion",
        people: 4, hurt: 0, missing: 0, needs: [], status: "assigned", created_at: now, updated_at: now,
      })
      .run();
    const { body } = await create(2, { report_code: "ABCD" });
    await one.PATCH(patch(body.id, confirmBody()), ctx(body.id));
    const report = db.select().from(schema.reports).all().find((r) => r.id === "rep1");
    expect(report?.status).toBe("visited");
    // The family timeline reads report.status_changed, so that is the row it writes.
    const rows = db.select().from(schema.events).where(eq(schema.events.entity_id, "rep1")).all();
    expect(rows.map((r) => r.type)).toEqual(["report.status_changed"]);
    expect(rows[0]).toMatchObject({ actor: "r1", data: { status: "visited", entry_id: body.id } });
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

    it("returns the same entry with 200 for a repeat, and stores no files and no draft again", async () => {
      const client_id = "3f6c2a1e-9b0d-4c55-8a7e-1d2f3a4b5c6d";
      const first = await entries.POST(postForm(2, { client_id }));
      const filesAfterFirst = onDisk();
      const again = await entries.POST(postForm(2, { client_id }));
      const body = await again.json();

      expect(first.status).toBe(201);
      expect(again.status).toBe(200);
      expect(body.id).toBe((await first.json()).id);
      expect(body).toMatchObject({ status: "draft", entry: { id: body.id, client_id } });
      expect(rowsFor(client_id)).toHaveLength(1);
      expect(onDisk()).toBe(filesAfterFirst);
      expect(db.select().from(schema.photos).where(eq(schema.photos.entry_id, body.id)).all()).toHaveLength(2);
      expect(trail(body.id)).toEqual(["entry.created", "ai.photo"]);
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
      expect(trail(x.id)).toEqual(["entry.created", "ai.photo"]);
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
        .values({ id: "other-entry", number: 9001, responder_id: "r3", barangay: "Poblacion", client_id, created_at: new Date().toISOString() })
        .run();
      const before = onDisk();
      const res = await entries.POST(postForm(1, { client_id }));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "client_id_taken" });
      expect(onDisk()).toBe(before);
      expect(rowsFor(client_id)).toHaveLength(1);
    });
  });

  describe("PATCH by a responder", () => {
    const row = (id: string) => db.select().from(schema.entries).where(eq(schema.entries.id, id)).get()!;

    it("answers 404 for an entry that belongs to another responder, and changes nothing", async () => {
      db.insert(schema.responders).values({ id: "r2", name: "Ben", team: "B", active: true }).run();
      const { body } = await create(2);
      db.update(schema.entries).set({ responder_id: "r2" }).where(eq(schema.entries.id, body.id)).run();
      const before = row(body.id);
      const res = await one.PATCH(patch(body.id, confirmBody()), ctx(body.id));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
      expect(row(body.id)).toEqual(before);
      // Staff are not tied to an owner, but the entry must wait for review.
      expect((await one.PATCH(patch(body.id, confirmBody(), staff), ctx(body.id))).status).toBe(409);
    });

    it("refuses a confirmed entry with 409 not_a_draft and changes nothing", async () => {
      const { body } = await create(2);
      expect((await one.PATCH(patch(body.id, confirmBody()), ctx(body.id))).status).toBe(200);
      const before = row(body.id);
      const res = await one.PATCH(patch(body.id, confirmBody({ damage_class: "none", people: 9 })), ctx(body.id));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "not_a_draft" });
      expect(row(body.id)).toEqual(before);
    });

    it("refuses a needs_review entry with 409 not_a_draft, also when it sends the status it saw", async () => {
      const { body } = await create(2);
      expect((await (await one.PATCH(patch(body.id, confirmBody({ damage_class: "partial" })), ctx(body.id))).json()).status).toBe("needs_review");
      const before = row(body.id);
      for (const headers of [resp, { ...resp, "x-ulat-expect-status": "needs_review" }]) {
        const res = await one.PATCH(patch(body.id, confirmBody({ damage_class: "total" }), headers), ctx(body.id));
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: "not_a_draft" });
      }
      expect(row(body.id)).toEqual(before);
    });

    it("still lets staff settle a needs_review entry", async () => {
      const { body } = await create(2);
      await one.PATCH(patch(body.id, confirmBody({ damage_class: "partial" })), ctx(body.id));
      const res = await one.PATCH(patch(body.id, confirmBody({ damage_class: "partial" }), staff), ctx(body.id));
      expect((await res.json()).status).toBe("confirmed");
      expect(row(body.id).status).toBe("confirmed");
    });
  });
});
