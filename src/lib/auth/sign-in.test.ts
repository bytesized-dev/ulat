import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FAILURES, resetLimiter } from "./limiter";
import {
  SESSION_COOKIE,
  requireResponder,
  requireResponderOrStaff,
  sessionExpiry,
  signSession,
} from "./session";

// The PIN and password check is slow on purpose, so parallel requests overlap
// the way they do with scrypt on the thread pool. The staff PIN is 1234 and the
// responder password is 123456 here.
const verifyPin = vi.hoisted(() =>
  vi.fn(async (pin: string) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return pin === "1234" || pin === "123456";
  }),
);

const jar = vi.hoisted(() => new Map<string, string>());
const activeResponders = vi.hoisted(() => new Set<string>());

vi.mock("@/lib/pin", () => ({ verifyPin }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));
vi.mock("./responders", () => ({ isActiveResponder: (id: string) => activeResponders.has(id) }));
vi.mock("@/lib/auth/settings", () => ({
  readSetting: () => "scrypt$salt$hash",
  readOrCreateSetting: () => "ab".repeat(32),
}));
vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => ({
            id: "r1",
            name: "Mae Santos",
            team: null,
            active: true,
            email: "mae@example.com",
            password_hash: "scrypt$salt$hash",
          }),
        }),
      }),
    }),
  },
}));

import * as responderRoute from "@/app/api/auth/responder/route";
import * as staffRoute from "@/app/api/auth/staff/route";

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://hub.test/api/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const staff = (pin: string, headers?: Record<string, string>) => staffRoute.POST(post("staff", { pin }, headers));
const responder = (password: string, headers?: Record<string, string>) =>
  responderRoute.POST(post("responder", { email: "mae@example.com", password }, headers));

const statuses = (responses: Response[]) => responses.map((r) => r.status).sort();

beforeEach(() => {
  resetLimiter();
  verifyPin.mockClear();
  jar.clear();
  activeResponders.clear();
});

describe("parallel sign in attempts", () => {
  it("lets at most 5 of 10 parallel staff attempts reach verifyPin", async () => {
    const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => staff(String(1000 + i))));
    expect(verifyPin.mock.calls.length).toBeLessThanOrEqual(MAX_FAILURES);
    expect(statuses(responses)).toEqual([401, 401, 401, 401, 401, 429, 429, 429, 429, 429]);
  });

  it("lets at most 5 of 10 parallel responder attempts reach verifyPin", async () => {
    const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => responder(`wrong${i}`)));
    expect(verifyPin.mock.calls.length).toBeLessThanOrEqual(MAX_FAILURES);
    expect(statuses(responses)).toEqual([401, 401, 401, 401, 401, 429, 429, 429, 429, 429]);
  });

  it("keeps refusing after the batch, even with the right PIN", async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => staff(String(1000 + i))));
    expect((await staff("1234")).status).toBe(429);
  });

  it("does not use up tries on bodies that are not a PIN guess", async () => {
    for (let i = 0; i < 10; i++) expect((await staffRoute.POST(post("staff", { pin: "12" }))).status).toBe(400);
    expect((await staff("1234")).status).toBe(200);
  });
});

describe("one count per route", () => {
  it("does not let a responder sign in clear the staff count", async () => {
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < MAX_FAILURES - 1; i++) {
        const wrong = await staff("0000");
        if (round === 0) expect(wrong.status).toBe(401);
      }
      expect((await responder("123456")).status).toBe(200);
    }
    // Each round left the staff bucket 4 wrong tries deeper than a reset would.
    expect((await staff("0000")).status).toBe(429);
  });

  it("keeps the responder and staff counts apart", async () => {
    for (let i = 0; i < MAX_FAILURES; i++) await staff("0000");
    expect((await staff("1234")).status).toBe(429);
    expect((await responder("123456")).status).toBe(200);
  });
});

describe("responder guard", () => {
  const secret = Buffer.from("ab".repeat(32), "hex");
  const signIn = () => {
    jar.set(
      SESSION_COOKIE.responder,
      signSession({ role: "responder", responder_id: "r1", name: "Mae Santos", exp: sessionExpiry() }, secret),
    );
  };

  it("returns the session while the responder is active", async () => {
    activeResponders.add("r1");
    signIn();
    expect(await requireResponder()).toMatchObject({ role: "responder", responder_id: "r1", name: "Mae Santos" });
  });

  it("returns 401 once the responder is switched off, with the cookie still valid", async () => {
    activeResponders.add("r1");
    signIn();
    activeResponders.delete("r1");
    const result = await requireResponder();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("returns 401 for a responder that no longer exists", async () => {
    signIn();
    expect(((await requireResponder()) as Response).status).toBe(401);
  });

  it("falls through to staff for a switched off responder, and to 401 without one", async () => {
    signIn();
    expect(((await requireResponderOrStaff()) as Response).status).toBe(401);
    jar.set(SESSION_COOKIE.staff, signSession({ role: "staff", exp: sessionExpiry() }, secret));
    expect(await requireResponderOrStaff()).toMatchObject({ role: "staff" });
  });
});
