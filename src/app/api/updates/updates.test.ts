// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, postJson, published } from "@/lib/hub/test-setup";

vi.mock("@/lib/auth/session", async () => (await import("@/lib/hub/test-setup")).sessionMock);
vi.mock("@/lib/live/bus", async () => (await import("@/lib/hub/test-setup")).busMock);

const body = (extra: object = {}) => ({
  type: "water_food",
  headline: "Water at the town plaza",
  message: "3 to 5 PM. Bring a container.",
  message_ceb: null,
  message_tl: null,
  place_id: null,
  ...extra,
});

describe("updates API", () => {
  let route: typeof import("./route");
  let db: Awaited<ReturnType<typeof freshDb>>["db"];
  let schema: Awaited<ReturnType<typeof freshDb>>["schema"];

  beforeAll(async () => {
    ({ db, schema } = await freshDb("updates"));
    route = await import("./route");
    const row = { type: "notice", message: "m", posted_at: "" } as const;
    db.insert(schema.updates)
      .values([
        { ...row, headline: "Older", posted_at: "2026-10-10T04:20:00.000Z" },
        { ...row, headline: "Newer", posted_at: "2026-10-10T06:30:00.000Z" },
        { ...row, headline: "Expired", posted_at: "2026-10-10T07:00:00.000Z", expires_at: "2020-01-01T00:00:00.000Z" },
        { ...row, headline: "Not yet expired", posted_at: "2026-10-10T05:00:00.000Z", expires_at: "2999-01-01T00:00:00.000Z" },
      ])
      .run();
  });

  beforeEach(() => {
    published.length = 0;
  });

  it("lists active updates newest first, without a session", async () => {
    const res = await route.GET();
    expect(res.status).toBe(200);
    const { updates } = await res.json();
    expect(updates.map((u: { headline: string }) => u.headline)).toEqual(["Newer", "Not yet expired", "Older"]);
  });

  it("refuses a post without a staff session", async () => {
    expect((await route.POST(postJson("/api/updates", null, body()))).status).toBe(401);
    expect((await route.POST(postJson("/api/updates", "responder", body()))).status).toBe(401);
    expect(published).toEqual([]);
  });

  it("rejects a body that is not NewUpdate", async () => {
    expect((await route.POST(postJson("/api/updates", "staff", "not json"))).status).toBe(400);
    const res = await route.POST(postJson("/api/updates", "staff", body({ type: "party" })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_request");
    expect(published).toEqual([]);
  });

  it("saves a staff post and emits update.posted", async () => {
    const res = await route.POST(postJson("/api/updates", "staff", body({ message_ceb: "Tubig sa plaza" })));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(published).toEqual([{ type: "update.posted", update_id: id }]);

    const { updates } = await (await route.GET()).json();
    expect(updates.find((u: { id: string }) => u.id === id)).toMatchObject({
      headline: "Water at the town plaza",
      message_ceb: "Tubig sa plaza",
    });
  });
});
