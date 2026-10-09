import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FAILURES, resetLimiter } from "./limiter";

// The PIN check is slow on purpose, so parallel requests overlap the way they
// do with scrypt on the thread pool.
const verifyPin = vi.hoisted(() =>
  vi.fn(async (pin: string) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return pin === "1234" || pin === "123456";
  }),
);

vi.mock("@/lib/pin", () => ({ verifyPin }));
vi.mock("@/lib/auth/settings", () => ({
  readSetting: () => "scrypt$salt$hash",
  readOrCreateSetting: () => "ab".repeat(32),
}));
vi.mock("@/db/client", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ all: () => [{ id: "r1", name: "Mae Santos", team: null, active: true }] }) }) }) },
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
const responder = (pin: string, headers?: Record<string, string>) =>
  responderRoute.POST(post("responder", { name: "Mae Santos", pin }, headers));

const statuses = (responses: Response[]) => responses.map((r) => r.status).sort();

beforeEach(() => {
  resetLimiter();
  verifyPin.mockClear();
});

describe("parallel sign in attempts", () => {
  it("lets at most 5 of 10 parallel staff attempts reach verifyPin", async () => {
    const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => staff(String(1000 + i))));
    expect(verifyPin.mock.calls.length).toBeLessThanOrEqual(MAX_FAILURES);
    expect(statuses(responses)).toEqual([401, 401, 401, 401, 401, 429, 429, 429, 429, 429]);
  });

  it("lets at most 5 of 10 parallel responder attempts reach verifyPin", async () => {
    const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => responder(String(100000 + i))));
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
