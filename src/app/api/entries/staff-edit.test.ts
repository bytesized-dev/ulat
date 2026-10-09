// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, published, request } from "@/lib/hub/test-setup";

// PATCH /api/entries/[id] as staff on an entry that is already confirmed is a
// field edit. It is not a new confirmation: the status, confirmed_by and
// confirmed_at stay, and the report is left alone.

vi.mock("@/lib/auth/session", async () => (await import("@/lib/hub/test-setup")).sessionMock);
vi.mock("@/lib/live/bus", async () => (await import("@/lib/hub/test-setup")).busMock);

let db: Awaited<ReturnType<typeof freshDb>>["db"];
let schema: Awaited<ReturnType<typeof freshDb>>["schema"];
let route: typeof import("./[id]/route");
let responderId: string;

const CONFIRMED_AT = "2026-10-10T07:00:00.000Z";
const REPORT_UPDATED_AT = "2026-10-10T07:00:01.000Z";

const body = (patch: Record<string, unknown> = {}) => ({
  damage_class: "total",
  material: "mixed",
  hazards: [],
  families: 1,
  people: 4,
  hurt: 0,
  missing: 0,
  needs: [],
  new_photo_since_unclear: false,
  ...patch,
});

beforeAll(async () => {
  ({ db, schema } = await freshDb("staff-edit"));
  route = await import("./[id]/route");
  responderId = db.insert(schema.responders).values({ name: "Jun Reyes" }).returning().get().id;
});

beforeEach(() => {
  published.length = 0;
});

let number = 500;
function newConfirmed(status: "confirmed" | "needs_review" = "confirmed") {
  const n = number++;
  const report = db
    .insert(schema.reports)
    .values({ code: `S${n}`, source: "family", household_head: "Lopez", barangay: "Sinonoc", status: status === "confirmed" ? "visited" : "assigned", created_at: "2026-10-10T06:00:00.000Z", updated_at: REPORT_UPDATED_AT })
    .returning()
    .get();
  const entry = db
    .insert(schema.entries)
    .values({
      number: n,
      report_id: report.id,
      responder_id: responderId,
      barangay: "Sinonoc",
      damage_class: "total",
      ai_class: "total",
      material: "mixed",
      people: 4,
      status,
      confirmed_by: status === "confirmed" ? responderId : null,
      confirmed_at: status === "confirmed" ? CONFIRMED_AT : null,
      created_at: "2026-10-10T06:51:00.000Z",
    })
    .returning()
    .get();
  return { id: entry.id, reportId: report.id };
}

function patch(id: string, payload: unknown, headers: Record<string, string> = {}) {
  const req = request(`/api/entries/${id}`, "staff", { method: "PATCH", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(payload) });
  return route.PATCH(req, { params: Promise.resolve({ id }) });
}

const rows = (entityId: string) => db.select().from(schema.events).where(eq(schema.events.entity_id, entityId)).all();
const entryRow = (id: string) => db.select().from(schema.entries).where(eq(schema.entries.id, id)).get()!;
const reportRow = (id: string) => db.select().from(schema.reports).where(eq(schema.reports.id, id)).get()!;
const types = () => published.map((e) => (e as { type: string }).type);

describe("a staff edit of a confirmed entry", () => {
  it("changes the fields and keeps who confirmed it and when", async () => {
    const { id } = newConfirmed();
    const res = await patch(id, body({ people: 6, hurt: 2 }));
    expect(res.status).toBe(200);
    expect(entryRow(id)).toMatchObject({ people: 6, hurt: 2, status: "confirmed", confirmed_by: responderId, confirmed_at: CONFIRMED_AT });
  });

  it("audits each changed field and writes no confirmed or visited row", async () => {
    const { id, reportId } = newConfirmed();
    await patch(id, body({ people: 6, hurt: 2 }));
    expect(rows(id).map((e) => e.type).sort()).toEqual(["entry.field_changed", "entry.field_changed"]);
    expect(rows(id).map((e) => (e.data as { field: string }).field).sort()).toEqual(["hurt", "people"]);
    expect(rows(reportId)).toEqual([]);
  });

  it("leaves the report status and its update time alone", async () => {
    const { id, reportId } = newConfirmed();
    await patch(id, body({ people: 6 }));
    expect(reportRow(reportId)).toMatchObject({ status: "visited", updated_at: REPORT_UPDATED_AT });
  });

  it("emits entry.confirmed as the refresh signal and no report.updated", async () => {
    const { id } = newConfirmed();
    await patch(id, body({ people: 6 }));
    expect(types()).toEqual(["entry.confirmed"]);
  });

  it("writes nothing and emits nothing when no field changed", async () => {
    const { id, reportId } = newConfirmed();
    const before = entryRow(id);
    const res = await patch(id, body());
    expect(res.status).toBe(200);
    expect(entryRow(id)).toEqual(before);
    expect(rows(id)).toEqual([]);
    expect(rows(reportId)).toEqual([]);
    expect(reportRow(reportId).updated_at).toBe(REPORT_UPDATED_AT);
    expect(published).toEqual([]);
  });

  it("still refuses a save that carries x-ulat-expect-status for an entry already confirmed", async () => {
    const { id } = newConfirmed();
    const res = await patch(id, body({ people: 6 }), { "x-ulat-expect-status": "needs_review" });
    expect(res.status).toBe(409);
    expect(entryRow(id).people).toBe(4);
    expect(rows(id)).toEqual([]);
    expect(published).toEqual([]);
  });
});

describe("a staff save on an entry in review", () => {
  it("still confirms it, audits the confirmation and marks the report visited", async () => {
    const { id, reportId } = newConfirmed("needs_review");
    const res = await patch(id, body({ people: 6 }), { "x-ulat-expect-status": "needs_review" });
    expect(res.status).toBe(200);
    const row = entryRow(id);
    expect(row.status).toBe("confirmed");
    expect(row.confirmed_by).toBe("staff");
    expect(row.confirmed_at).not.toBeNull();
    expect(rows(id).filter((e) => e.type === "entry.confirmed")).toHaveLength(1);
    expect(rows(reportId).filter((e) => e.type === "report.visited")).toHaveLength(1);
    expect(reportRow(reportId).status).toBe("visited");
    expect(types()).toEqual(["entry.confirmed", "report.updated"]);
  });
});
