// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { placeToUpdate } from "@/lib/hub/places";
import { freshDb, postJson, published, session } from "@/lib/hub/test-setup";

vi.mock("@/lib/auth/session", async () => (await import("@/lib/hub/test-setup")).sessionMock);
vi.mock("@/lib/live/bus", async () => (await import("@/lib/hub/test-setup")).busMock);

const body = (extra: object = {}) => ({
  type: "relief",
  name: "Water distribution",
  details: "Town plaza",
  when_text: "Today, 3 to 5 PM",
  lat: 8.65,
  lng: 123.42,
  visible: true,
  post_as_update: false,
  ...extra,
});

describe("placeToUpdate", () => {
  it("maps the place type and joins details and time", () => {
    expect(placeToUpdate(body() as never, "p1")).toEqual({
      type: "water_food",
      headline: "Water distribution",
      message: "Town plaza. Today, 3 to 5 PM",
      message_ceb: null,
      message_tl: null,
      place_id: "p1",
    });
  });
  it("falls back to the name when there are no details", () => {
    const update = placeToUpdate(body({ type: "hazard", details: null, when_text: " " }) as never, "p1");
    expect(update).toMatchObject({ type: "hazard", message: "Water distribution" });
  });
});

describe("places API", () => {
  let route: typeof import("./route");
  let db: Awaited<ReturnType<typeof freshDb>>["db"];
  let schema: Awaited<ReturnType<typeof freshDb>>["schema"];

  const list = async (role: "staff" | null) => {
    session.role = role;
    const res = await route.GET();
    expect(res.status).toBe(200);
    return (await res.json()).places as { id: string; name: string }[];
  };

  beforeAll(async () => {
    ({ db, schema } = await freshDb("places"));
    route = await import("./route");
    const row = { type: "shelter", lat: 1, lng: 2, created_at: "2026-10-10T04:00:00.000Z" } as const;
    db.insert(schema.places)
      .values([
        { ...row, name: "Covered court", visible: true },
        { ...row, name: "Old school", visible: false },
      ])
      .run();
  });

  beforeEach(() => {
    published.length = 0;
  });

  it("shows only visible places to families, and all places to staff", async () => {
    expect((await list(null)).map((p) => p.name)).toEqual(["Covered court"]);
    expect((await list("staff")).map((p) => p.name).sort()).toEqual(["Covered court", "Old school"]);
  });

  it("refuses a post without a staff session", async () => {
    expect((await route.POST(postJson("/api/places", null, body()))).status).toBe(401);
    expect((await route.POST(postJson("/api/places", "responder", body()))).status).toBe(401);
  });

  it("rejects a body that is not NewPlace", async () => {
    expect((await route.POST(postJson("/api/places", "staff", body({ lat: "north" })))).status).toBe(400);
    expect((await route.POST(postJson("/api/places", "staff", body({ name: "" })))).status).toBe(400);
    expect(published).toEqual([]);
  });

  it("saves a place and emits place.saved without an update", async () => {
    const before = db.select().from(schema.updates).all().length;
    const res = await route.POST(postJson("/api/places", "staff", body()));
    expect(res.status).toBe(201);
    const { id, update_id } = await res.json();
    expect(update_id).toBeNull();
    expect(published).toEqual([{ type: "place.saved", place_id: id }]);
    expect(db.select().from(schema.updates).all()).toHaveLength(before);
    expect((await list(null)).some((p) => p.id === id)).toBe(true);
  });

  it("posts an update linked to the place when post_as_update is true", async () => {
    const res = await route.POST(postJson("/api/places", "staff", body({ post_as_update: true })));
    const { id, update_id } = await res.json();
    expect(published).toEqual([
      { type: "place.saved", place_id: id },
      { type: "update.posted", update_id },
    ]);
    const update = db.select().from(schema.updates).all().find((u) => u.id === update_id);
    expect(update).toMatchObject({ place_id: id, type: "water_food", headline: "Water distribution" });
  });

  it("keeps a hidden place off the family map", async () => {
    const { id } = await (await route.POST(postJson("/api/places", "staff", body({ visible: false })))).json();
    expect((await list(null)).some((p) => p.id === id)).toBe(false);
    expect((await list("staff")).some((p) => p.id === id)).toBe(true);
  });
});
