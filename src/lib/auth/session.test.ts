import { beforeEach, describe, expect, it } from "vitest";
import { BLOCK_MS, MAX_FAILURES, beginAttempt, blockedSeconds, clientKey, endAttempt, resetLimiter } from "./limiter";
import { sessionExpiry, signSession, verifySession, type ResponderSession, type StaffSession } from "./session";

const secret = Buffer.from("a".repeat(64), "hex");
const now = 1_700_000_000_000;

const responder: ResponderSession = { role: "responder", responder_id: "r1", name: "Mae Santos", exp: now + 60_000 };
const staff: StaffSession = { role: "staff", exp: now + 60_000 };

describe("session tokens", () => {
  it("round trips a responder and a staff session", () => {
    expect(verifySession(signSession(responder, secret), secret, "responder", now)).toEqual(responder);
    expect(verifySession(signSession(staff, secret), secret, "staff", now)).toEqual(staff);
  });

  it("rejects a tampered payload", () => {
    const [, signature] = signSession(responder, secret).split(".");
    const forged = Buffer.from(JSON.stringify({ ...responder, name: "Someone Else" })).toString("base64url");
    expect(verifySession(`${forged}.${signature}`, secret, "responder", now)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const [body, signature] = signSession(responder, secret).split(".");
    const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    expect(verifySession(`${body}.${flipped}`, secret, "responder", now)).toBeNull();
    expect(verifySession(`${body}.${signature.slice(1)}`, secret, "responder", now)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const other = Buffer.from("b".repeat(64), "hex");
    expect(verifySession(signSession(staff, other), secret, "staff", now)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signSession(staff, secret);
    expect(verifySession(token, secret, "staff", staff.exp - 1)).toEqual(staff);
    expect(verifySession(token, secret, "staff", staff.exp)).toBeNull();
  });

  it("does not accept a responder token where staff is required", () => {
    expect(verifySession(signSession(responder, secret), secret, "staff", now)).toBeNull();
    expect(verifySession(signSession(staff, secret), secret, "responder", now)).toBeNull();
  });

  it("rejects missing and malformed tokens", () => {
    expect(verifySession(undefined, secret, "staff", now)).toBeNull();
    expect(verifySession("", secret, "staff", now)).toBeNull();
    expect(verifySession("not-a-token", secret, "staff", now)).toBeNull();
    expect(verifySession("a.b.c", secret, "staff", now)).toBeNull();
  });

  it("expires 12 hours after it starts", () => {
    expect(sessionExpiry(now) - now).toBe(12 * 60 * 60 * 1000);
  });
});

describe("sign in limiter", () => {
  beforeEach(resetLimiter);

  const fail = (key: string, at: number) => {
    expect(beginAttempt(key, at)).toBe(true);
    endAttempt(key, "wrong", at);
  };

  it("blocks an address for 30 seconds after 5 wrong tries", () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) fail("lan-1", now);
    expect(blockedSeconds("lan-1", now)).toBe(0);
    fail("lan-1", now);
    expect(blockedSeconds("lan-1", now)).toBe(BLOCK_MS / 1000);
    expect(blockedSeconds("lan-1", now + BLOCK_MS - 1)).toBe(1);
    expect(blockedSeconds("lan-1", now + BLOCK_MS)).toBe(0);
  });

  it("keeps one address from blocking another", () => {
    for (let i = 0; i < MAX_FAILURES; i++) fail("lan-1", now);
    expect(blockedSeconds("lan-2", now)).toBe(0);
    expect(beginAttempt("lan-2", now)).toBe(true);
  });

  it("starts the count again after a block ends", () => {
    for (let i = 0; i < MAX_FAILURES; i++) fail("lan-1", now);
    const later = now + BLOCK_MS;
    for (let i = 0; i < MAX_FAILURES - 1; i++) fail("lan-1", later);
    expect(blockedSeconds("lan-1", later)).toBe(0);
  });

  it("clears the count on a correct PIN", () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) fail("lan-1", now);
    expect(beginAttempt("lan-1", now)).toBe(true);
    endAttempt("lan-1", "right", now);
    fail("lan-1", now);
    expect(blockedSeconds("lan-1", now)).toBe(0);
    expect(beginAttempt("lan-1", now)).toBe(true);
  });

  it("counts attempts that are still running", () => {
    for (let i = 0; i < MAX_FAILURES; i++) expect(beginAttempt("lan-1", now)).toBe(true);
    expect(beginAttempt("lan-1", now)).toBe(false);
    endAttempt("lan-1", "none", now);
    expect(beginAttempt("lan-1", now)).toBe(true);
  });

  it("reads the address Caddy added to x-forwarded-for", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "10.0.0.9, 192.168.1.20" }))).toBe("192.168.1.20");
    expect(clientKey(new Headers())).toBe("direct");
  });
});
