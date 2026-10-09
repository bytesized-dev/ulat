// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import { freshDb, session } from "@/lib/hub/test-setup";

vi.mock("@/lib/auth/session", async () => (await import("@/lib/hub/test-setup")).sessionMock);

describe("GET /api/export/entries.csv", () => {
  let route: typeof import("./route");

  beforeAll(async () => {
    const { db, schema } = await freshDb("entries-csv-api");
    route = await import("./route");
    db.insert(schema.responders).values({ id: "r1", name: "Ana Reyes" }).run();
    const base = { responder_id: "r1", barangay: "Sinonoc", created_at: "2026-10-10T06:00:00.000Z" };
    db.insert(schema.entries)
      .values([
        { ...base, number: 231, status: "confirmed", damage_class: "total", household_head: "Cruz, Maria" },
        { ...base, number: 232, status: "needs_review", damage_class: "total", household_head: "Hidden" },
      ])
      .run();
  });

  it("returns 401 without a session and sends no data", async () => {
    session.role = null;
    const res = await route.GET();
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("Cruz");
  });

  it("returns 401 for a responder", async () => {
    session.role = "responder";
    expect((await route.GET()).status).toBe(401);
  });

  it("sends confirmed entries as an attachment to staff", async () => {
    session.role = "staff";
    const res = await route.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="ulat-entries-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    // Response.text() drops the byte order mark, so check the raw bytes.
    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = await res.text();
    expect(text.startsWith("Entry number,Household head,")).toBe(true);
    expect(text).toContain('0231,"Cruz, Maria",Sinonoc');
    expect(text).not.toContain("Hidden");
  });
});
