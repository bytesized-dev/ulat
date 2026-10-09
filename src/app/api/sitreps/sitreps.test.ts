// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import { freshDb, session } from "@/lib/hub/test-setup";

vi.mock("@/lib/auth/session", async () => (await import("@/lib/hub/test-setup")).sessionMock);

describe("POST /api/sitreps", () => {
  let route: typeof import("./route");
  let db: Awaited<ReturnType<typeof freshDb>>["db"];
  let schema: Awaited<ReturnType<typeof freshDb>>["schema"];

  const count = () => db.select().from(schema.sitreps).all().length;

  beforeAll(async () => {
    ({ db, schema } = await freshDb("sitreps-api"));
    route = await import("./route");
  });

  it("returns 401 without a session and saves nothing", async () => {
    session.role = null;
    const res = await route.POST();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(count()).toBe(0);
  });

  it("returns 401 for a responder and saves nothing", async () => {
    session.role = "responder";
    expect((await route.POST()).status).toBe(401);
    expect(count()).toBe(0);
  });

  it("saves the next report for staff and returns it, uncached", async () => {
    session.role = "staff";
    const first = await route.POST();
    expect(first.status).toBe(201);
    expect(first.headers.get("cache-control")).toBe("no-store");
    const body = await first.json();
    expect(body).toMatchObject({ number: 1, snapshot: { houses_checked: 0 } });
    expect(body.sms).toContain("SITREP 1,");

    const second = await (await route.POST()).json();
    expect(second.number).toBe(2);
    expect(count()).toBe(2);
  });
});
