import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, sessionExpiry, signSession } from "@/lib/auth/session";
import type { HubSummary } from "@/lib/contracts";

// The real requireStaff runs here. Only the cookie jar, the signing secret and
// the summary query are stubs, so this checks the guard and not a mock of it.

const SECRET_HEX = "ab".repeat(32);
const secret = Buffer.from(SECRET_HEX, "hex");

const jar = vi.hoisted(() => new Map<string, string>());
const summary = vi.hoisted(() => ({ houses_checked: 46, barangays: [] }) as unknown as HubSummary);
const getHubSummary = vi.hoisted(() => vi.fn(() => summary));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));
vi.mock("@/lib/auth/settings", () => ({ readOrCreateSetting: () => SECRET_HEX }));
vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/hub/summary", () => ({ getHubSummary }));

import { GET } from "./route";

const staffToken = (exp = sessionExpiry()) => signSession({ role: "staff", exp }, secret);

beforeEach(() => {
  jar.clear();
  getHubSummary.mockClear();
});

describe("GET /api/hub/summary", () => {
  it("returns 401 without a staff cookie and never runs the query", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(getHubSummary).not.toHaveBeenCalled();
  });

  it("returns 401 for a responder session, even in the staff cookie", async () => {
    const responder = signSession({ role: "responder", responder_id: "r1", name: "Mae Santos", exp: sessionExpiry() }, secret);
    jar.set(SESSION_COOKIE.responder, responder);
    expect((await GET()).status).toBe(401);
    jar.set(SESSION_COOKIE.staff, responder);
    expect((await GET()).status).toBe(401);
    expect(getHubSummary).not.toHaveBeenCalled();
  });

  it("returns 401 for a tampered staff token", async () => {
    const [body] = staffToken().split(".");
    jar.set(SESSION_COOKIE.staff, `${body}.${"x".repeat(43)}`);
    expect((await GET()).status).toBe(401);
  });

  it("returns 401 for an expired staff token", async () => {
    jar.set(SESSION_COOKIE.staff, staffToken(Date.now() - 1000));
    expect((await GET()).status).toBe(401);
  });

  it("returns the summary to staff, uncached", async () => {
    jar.set(SESSION_COOKIE.staff, staffToken());
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(summary);
    expect(getHubSummary).toHaveBeenCalledTimes(1);
  });
});
