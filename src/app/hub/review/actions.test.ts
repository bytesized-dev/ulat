// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, published, request, session } from "@/lib/hub/test-setup";

vi.mock("@/lib/auth/session", async () => (await import("@/lib/hub/test-setup")).sessionMock);
vi.mock("@/lib/live/bus", async () => (await import("@/lib/hub/test-setup")).busMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let db: Awaited<ReturnType<typeof freshDb>>["db"];
let schema: Awaited<ReturnType<typeof freshDb>>["schema"];
let actions: typeof import("./actions");
let entryRoute: typeof import("@/app/api/entries/[id]/route");
let entryId: string;

beforeAll(async () => {
  ({ db, schema } = await freshDb("review-action"));
  actions = await import("./actions");
  entryRoute = await import("@/app/api/entries/[id]/route");
  const responder = db.insert(schema.responders).values({ name: "Jun Reyes" }).returning().get();
  entryId = db
    .insert(schema.entries)
    .values({
      number: 238,
      responder_id: responder.id,
      barangay: "Sinonoc",
      household_head: "Lopez household",
      damage_class: "total",
      status: "needs_review",
      review_reason: "The hurt count is different from the family report.",
      created_at: "2026-09-04T06:51:00.000Z",
    })
    .returning()
    .get().id;
});

beforeEach(() => {
  session.role = null;
  published.length = 0;
});

const photoRequests = () => db.select().from(schema.events).where(eq(schema.events.type, "entry.photos_requested")).all();

describe("askForPhotosAction", () => {
  it("refuses a caller with no session and writes nothing", async () => {
    expect(await actions.askForPhotosAction(entryId)).toEqual({ ok: false, error: "unauthorized" });
    expect(photoRequests()).toHaveLength(0);
  });

  it("refuses a responder, since the second look is for staff", async () => {
    session.role = "responder";
    expect(await actions.askForPhotosAction(entryId)).toEqual({ ok: false, error: "unauthorized" });
    expect(photoRequests()).toHaveLength(0);
  });

  it("rejects an id that is not a uuid, whatever the type says", async () => {
    session.role = "staff";
    for (const bad of ["", "nope", 7, null, undefined, {}]) {
      expect(await actions.askForPhotosAction(bad as unknown as string)).toEqual({ ok: false, error: "invalid" });
    }
    expect(photoRequests()).toHaveLength(0);
  });

  it("writes the request for staff and leaves the entry in review", async () => {
    session.role = "staff";
    expect(await actions.askForPhotosAction(entryId)).toEqual({ ok: true, already: false });
    expect(photoRequests()).toMatchObject([{ entity: "entry", entity_id: entryId, actor: "staff" }]);
    expect(db.select().from(schema.entries).where(eq(schema.entries.id, entryId)).get()?.status).toBe("needs_review");
    expect(published).toEqual([]);
  });

  it("does not write a second row for a second ask", async () => {
    session.role = "staff";
    expect(await actions.askForPhotosAction(entryId)).toEqual({ ok: true, already: true });
    expect(photoRequests()).toHaveLength(1);
  });

  it("says not found for an entry that does not exist", async () => {
    session.role = "staff";
    expect(await actions.askForPhotosAction(crypto.randomUUID())).toEqual({ ok: false, error: "not_found" });
  });
});

describe("the buttons that go through PATCH /api/entries/[id]", () => {
  it("approve: the route confirms the entry with the responder class and audits the change", async () => {
    const { listReviewEntries, reviewActions } = await import("@/lib/hub/review");
    const entry = listReviewEntries(db).find((e) => e.id === entryId)!;
    const { approve } = reviewActions(entry);
    expect(approve?.label).toBe("Approve totally damaged");

    const req = request(`/api/entries/${entryId}`, "staff", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(approve!.body),
    });
    const res = await entryRoute.PATCH(req, { params: Promise.resolve({ id: entryId }) });
    expect(res.status).toBe(200);

    const saved = db.select().from(schema.entries).where(eq(schema.entries.id, entryId)).get();
    expect(saved).toMatchObject({ status: "confirmed", damage_class: "total", confirmed_by: "staff" });
    const history = db.select().from(schema.events).where(eq(schema.events.entity_id, entryId)).all();
    expect(history.map((e) => e.type)).toEqual(expect.arrayContaining(["entry.field_changed", "entry.confirmed"]));
    expect(published).toContainEqual({ type: "entry.confirmed", entry_id: entryId, report_code: null });
  });
});
