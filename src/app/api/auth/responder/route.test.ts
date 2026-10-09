// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetLimiter } from "@/lib/auth/limiter";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { ResponderSignIn } from "@/lib/contracts";
import { freshDb } from "@/lib/hub/test-setup";
import { hashPin, verifyPin } from "@/lib/pin";

// The responder sign in against a real SQLite file and real scrypt. The mocked
// version in src/lib/auth/sign-in.test.ts covers the limiter. This one covers
// which account an email finds and what a miss looks like.

// Wrapped, not replaced, so the hash is really checked and the calls can be counted.
vi.mock("@/lib/pin", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/pin")>();
  return { ...real, verifyPin: vi.fn(real.verifyPin) };
});

const PASSWORD = "ulat2026";

describe("responder sign in by email and password", () => {
  let route: typeof import("./route");
  let db: Awaited<ReturnType<typeof freshDb>>["db"];
  let schema: Awaited<ReturnType<typeof freshDb>>["schema"];

  const signIn = (body: unknown) =>
    route.POST(
      new Request("http://hub.test/api/auth/responder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  beforeAll(async () => {
    ({ db, schema } = await freshDb("responder-sign-in"));
    route = await import("./route");
    const password_hash = await hashPin(PASSWORD);
    db.insert(schema.responders)
      .values([
        { id: "r1", name: "CJ Jutba", team: "Sinonoc", email: "cjjutba@gmail.com", password_hash },
        { id: "r2", name: "Artkin Carreon", team: "Sinonoc", email: "artkin@gmail.com", password_hash },
        { id: "off", name: "Switched Off", active: false, email: "off@gmail.com", password_hash },
        { id: "nopw", name: "No Password", email: "nopw@gmail.com", password_hash: null },
      ])
      .run();
  });

  beforeEach(() => {
    resetLimiter();
    vi.mocked(verifyPin).mockClear();
  });

  it("signs in with the right email and password and sets the responder cookie", async () => {
    const res = await signIn({ email: "cjjutba@gmail.com", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ responder: { id: "r1", name: "CJ Jutba" } });
    expect(res.headers.get("set-cookie")).toContain(`${SESSION_COOKIE.responder}=`);
  });

  it("finds the account whatever the case or the spaces around the email", async () => {
    const res = await signIn({ email: "  ArtKin@Gmail.COM \t", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ responder: { id: "r2", name: "Artkin Carreon" } });
  });

  it("checks the password against the account the email names, not another account", async () => {
    const res = await signIn({ email: "artkin@gmail.com", password: "ulat2027" });
    expect(res.status).toBe(401);
  });

  it("does not trim the password", async () => {
    expect((await signIn({ email: "cjjutba@gmail.com", password: ` ${PASSWORD}` })).status).toBe(401);
  });

  it("answers a wrong password and an unknown email with the same 401", async () => {
    const wrongPassword = await signIn({ email: "cjjutba@gmail.com", password: "nope" });
    const unknownEmail = await signIn({ email: "nobody@gmail.com", password: PASSWORD });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual({ error: "wrong_email_or_password" });
    expect(await unknownEmail.json()).toEqual({ error: "wrong_email_or_password" });
  });

  it("runs one scrypt check for an unknown email, so timing does not show which emails exist", async () => {
    await signIn({ email: "nobody@gmail.com", password: PASSWORD });
    expect(verifyPin).toHaveBeenCalledTimes(1);
    expect(vi.mocked(verifyPin).mock.calls[0][0]).toBe(PASSWORD);
  });

  it("refuses a switched off responder, even with the right password", async () => {
    const res = await signIn({ email: "off@gmail.com", password: PASSWORD });
    expect(res.status).toBe(401);
    expect(verifyPin).toHaveBeenCalledTimes(1);
  });

  it("refuses a responder who has no password yet, and still runs one check", async () => {
    const res = await signIn({ email: "nopw@gmail.com", password: PASSWORD });
    expect(res.status).toBe(401);
    expect(verifyPin).toHaveBeenCalledTimes(1);
  });

  it("does not let the old name and PIN body in", async () => {
    const res = await signIn({ name: "CJ Jutba", pin: "123456" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_body" });
    expect(verifyPin).not.toHaveBeenCalled();
  });

  it("rejects an empty email or password without a check", async () => {
    expect((await signIn({ email: "   ", password: PASSWORD })).status).toBe(400);
    expect((await signIn({ email: "cjjutba@gmail.com", password: "" })).status).toBe(400);
    expect(verifyPin).not.toHaveBeenCalled();
  });

  it("keeps the rate limiter: five wrong tries, then 429 even with the right password", async () => {
    for (let i = 0; i < 5; i++) expect((await signIn({ email: "cjjutba@gmail.com", password: `wrong${i}` })).status).toBe(401);
    const res = await signIn({ email: "cjjutba@gmail.com", password: PASSWORD });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).not.toBeNull();
  });

  it("does not use the team PIN setting any more", async () => {
    // A fresh database has no team_pin_hash. Before this change that was a 503.
    const res = await signIn({ email: "cjjutba@gmail.com", password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it("stores each email once, and lets several responders have none", () => {
    expect(() => db.insert(schema.responders).values({ name: "Copy", email: "cjjutba@gmail.com" }).run()).toThrow(/UNIQUE/);
    expect(() => {
      db.insert(schema.responders).values({ name: "Walk in one" }).run();
      db.insert(schema.responders).values({ name: "Walk in two" }).run();
    }).not.toThrow();
  });
});

describe("ResponderSignIn contract", () => {
  it("trims and lower cases the email, and keeps the password as typed", () => {
    expect(ResponderSignIn.parse({ email: " CJJutba@Gmail.com ", password: " pass word " })).toEqual({
      email: "cjjutba@gmail.com",
      password: " pass word ",
    });
  });
});
