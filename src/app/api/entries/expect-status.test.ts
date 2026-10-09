// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, published, request } from "@/lib/hub/test-setup";

// The opt-in guard on PATCH /api/entries/[id]: a caller that sends
// x-ulat-expect-status is refused when the entry is no longer in that status.

vi.mock("@/lib/auth/session", async () => (await import("@/lib/hub/test-setup")).sessionMock);
vi.mock("@/lib/live/bus", async () => (await import("@/lib/hub/test-setup")).busMock);

let db: Awaited<ReturnType<typeof freshDb>>["db"];
let schema: Awaited<ReturnType<typeof freshDb>>["schema"];
let route: typeof import("./[id]/route");
let responderId: string;

const body = (damage_class: "none" | "partial" | "total") => ({
  damage_class,
  material: "mixed",
  hazards: [],
  families: 1,
  people: 4,
  hurt: 0,
  missing: 0,
  needs: [],
  new_photo_since_unclear: false,
});

beforeAll(async () => {
  ({ db, schema } = await freshDb("expect-status"));
  route = await import("./[id]/route");
  responderId = db.insert(schema.responders).values({ name: "Jun Reyes" }).returning().get().id;
});

beforeEach(() => {
  published.length = 0;
});

let number = 300;
function newEntry(status: "needs_review" | "confirmed" = "needs_review") {
  return db
    .insert(schema.entries)
    .values({
      number: number++,
      responder_id: responderId,
      barangay: "Sinonoc",
      damage_class: "total",
      ai_class: "partial",
      status,
      created_at: "2026-10-10T06:51:00.000Z",
    })
    .returning()
    .get().id;
}

function patch(id: string, payload: unknown, headers: Record<string, string> = {}) {
  const req = request(`/api/entries/${id}`, "staff", {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
  return route.PATCH(req, { params: Promise.resolve({ id }) });
}

const expectReview = { "x-ulat-expect-status": "needs_review" };
const history = (id: string) => db.select().from(schema.events).where(eq(schema.events.entity_id, id)).all();
const saved = (id: string) => db.select().from(schema.entries).where(eq(schema.entries.id, id)).get()!;

describe("PATCH /api/entries/[id] with x-ulat-expect-status", () => {
  it("saves while the entry is in the status the caller saw", async () => {
    const id = newEntry();
    const res = await patch(id, body("partial"), expectReview);
    expect(res.status).toBe(200);
    expect(saved(id)).toMatchObject({ status: "confirmed", damage_class: "partial" });
    expect(published.filter((e) => (e as { type: string }).type === "entry.confirmed")).toHaveLength(1);
  });

  it("refuses a stale second save: 409, and no change, audit row or event", async () => {
    const id = newEntry();
    expect((await patch(id, body("partial"), expectReview)).status).toBe(200);
    const rows = history(id).length;
    published.length = 0;

    const stale = await patch(id, body("total"), expectReview);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: "not_in_review" });
    expect(saved(id).damage_class).toBe("partial");
    expect(history(id)).toHaveLength(rows);
    expect(history(id).filter((e) => e.type === "entry.confirmed")).toHaveLength(1);
    expect(published).toEqual([]);
  });

  it("refuses an entry that was confirmed before the first save", async () => {
    const id = newEntry("confirmed");
    const res = await patch(id, body("none"), expectReview);
    expect(res.status).toBe(409);
    expect(saved(id).damage_class).toBe("total");
    expect(history(id)).toEqual([]);
  });

  it("rejects a header that is not an entry status", async () => {
    const id = newEntry();
    const res = await patch(id, body("partial"), { "x-ulat-expect-status": "later" });
    expect(res.status).toBe(400);
    expect(saved(id).status).toBe("needs_review");
    expect(history(id)).toEqual([]);
  });

  it("still says 404 for an entry that does not exist", async () => {
    expect((await patch(crypto.randomUUID(), body("partial"), expectReview)).status).toBe(404);
  });
});

describe("PATCH /api/entries/[id] without the header", () => {
  it("behaves as before: a confirmed entry can be edited again", async () => {
    const id = newEntry("confirmed");
    const res = await patch(id, body("none"));
    expect(res.status).toBe(200);
    expect(saved(id)).toMatchObject({ status: "confirmed", damage_class: "none" });
    expect(history(id).filter((e) => e.type === "entry.confirmed")).toHaveLength(1);
  });
});
