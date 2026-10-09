// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { likePattern } from "@/lib/hub/safe";
import { freshDb, postJson, published, request } from "@/lib/hub/test-setup";

vi.mock("@/lib/auth/session", async () => (await import("@/lib/hub/test-setup")).sessionMock);
vi.mock("@/lib/live/bus", async () => (await import("@/lib/hub/test-setup")).busMock);

const body = (extra: object = {}) => ({
  name: "Lorna Bautista",
  barangay: "Sinonoc",
  staying_at: "With relatives",
  message: "We are fine, call Tita Bing",
  source: "phone",
  ...extra,
});

describe("likePattern", () => {
  it("escapes LIKE wildcards", () => {
    expect(likePattern("50%_a\\b")).toBe("%50\\%\\_a\\\\b%");
  });
});

describe("safe API", () => {
  let route: typeof import("./route");
  let db: Awaited<ReturnType<typeof freshDb>>["db"];
  let schema: Awaited<ReturnType<typeof freshDb>>["schema"];

  const search = async (q: string | null, role: "staff" | null = null) => {
    const res = await route.GET(request(q === null ? "/api/safe" : `/api/safe?q=${encodeURIComponent(q)}`, role));
    expect(res.status).toBe(200);
    return (await res.json()).results as Record<string, unknown>[];
  };

  beforeAll(async () => {
    ({ db, schema } = await freshDb("safe"));
    route = await import("./route");
    const row = { barangay: "Sinonoc", staying_at: "Covered court", message: "secret note", source: "phone" } as const;
    db.insert(schema.safe_checkins)
      .values([
        { ...row, name: "Ernesto Bautista", at: "2026-10-10T05:42:00.000Z" },
        { ...row, name: "Rogelio Bautista", at: "2026-10-10T06:10:00.000Z" },
        { ...row, name: "Maria 100% Cruz", at: "2026-10-10T06:20:00.000Z" },
      ])
      .run();
  });

  beforeEach(() => {
    published.length = 0;
  });

  it("finds by part of a name, any case, newest first", async () => {
    expect((await search("bautista")).map((r) => r.name)).toEqual(["Rogelio Bautista", "Ernesto Bautista"]);
  });

  it("returns only name, barangay, staying at and time, never the message", async () => {
    const [result] = await search("Ernesto");
    expect(Object.keys(result).sort()).toEqual(["at", "barangay", "name", "staying_at"]);
    expect(JSON.stringify(await search("Bautista", "staff"))).not.toContain("secret note");
    expect(JSON.stringify(await search(null, "staff"))).not.toContain("secret note");
  });

  it("treats % and _ as plain characters", async () => {
    expect((await search("0%")).map((r) => r.name)).toEqual(["Maria 100% Cruz"]);
    expect(await search("__")).toEqual([]);
  });

  it("returns nothing for a short or empty query, except the recent list for staff", async () => {
    expect(await search("B")).toEqual([]);
    expect(await search(null)).toEqual([]);
    expect(await search(" ")).toEqual([]);
    expect((await search(null, "staff")).map((r) => r.name)).toEqual([
      "Maria 100% Cruz",
      "Rogelio Bautista",
      "Ernesto Bautista",
    ]);
    expect(await search("B", "staff")).toEqual([]);
  });

  it("checks in from a phone without a session and emits safe.checked_in", async () => {
    const res = await route.POST(postJson("/api/safe", null, body()));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(published).toEqual([{ type: "safe.checked_in", id }]);
    const saved = db.select().from(schema.safe_checkins).all().find((r) => r.id === id);
    expect(saved).toMatchObject({ name: "Lorna Bautista", message: "We are fine, call Tita Bing", source: "phone" });
    expect((await search("Lorna"))[0]).not.toHaveProperty("message");
  });

  it("rejects a body that is not SafeCheckin", async () => {
    expect((await route.POST(postJson("/api/safe", null, body({ staying_at: "" })))).status).toBe(400);
    expect((await route.POST(postJson("/api/safe", null, body({ source: "radio" })))).status).toBe(400);
    expect((await route.POST(postJson("/api/safe", null, "{"))).status).toBe(400);
    expect(published).toEqual([]);
  });

  it("refuses a body over 32 KB with 413 and saves nothing", async () => {
    const big = `{"name":"Lorna Bautista","barangay":"Sinonoc","staying_at":"With relatives","source":"phone","message":"${"a".repeat(40_000)}"}`;
    const res = await route.POST(postJson("/api/safe", null, big));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
    expect(published).toEqual([]);
  });

  it("only lets staff check in as the desk", async () => {
    expect((await route.POST(postJson("/api/safe", null, body({ source: "desk" })))).status).toBe(401);
    expect((await route.POST(postJson("/api/safe", "responder", body({ source: "desk" })))).status).toBe(401);
    expect((await route.POST(postJson("/api/safe", "staff", body({ source: "desk" })))).status).toBe(201);
  });
});
