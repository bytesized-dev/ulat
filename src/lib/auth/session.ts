/**
 * Signed cookie sessions for responders and MDRRMO staff.
 *
 * In a route handler, call a require helper first. It returns the session, or
 * a 401 Response that the handler returns as is:
 *
 *   const s = await requireStaff();
 *   if (s instanceof Response) return s;
 *   // s.role is "staff" here
 *
 * requireResponder() gives { role, responder_id, name, exp }, and 401 once the
 * responder is switched off.
 * requireResponderOrStaff() accepts either cookie, so check s.role after it.
 *
 * The cookie value is base64url(JSON payload) + "." + base64url(HMAC SHA-256).
 * The signing secret is the settings row "session_secret". The proxy in
 * src/proxy.ts only redirects pages. Route handlers still call the helpers.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { z } from "zod";

export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export const SESSION_COOKIE = { responder: "ulat_responder", staff: "ulat_staff" } as const;

const ResponderPayload = z.object({
  role: z.literal("responder"),
  responder_id: z.string().min(1),
  name: z.string().min(1),
  exp: z.number().int(),
});
const StaffPayload = z.object({ role: z.literal("staff"), exp: z.number().int() });
const Payload = z.discriminatedUnion("role", [ResponderPayload, StaffPayload]);

export type ResponderSession = z.infer<typeof ResponderPayload>;
export type StaffSession = z.infer<typeof StaffPayload>;
export type SessionRole = keyof typeof SESSION_COOKIE;

type SessionByRole = { responder: ResponderSession; staff: StaffSession };

/* ---------- Tokens, pure and testable without a database ---------- */

function mac(body: string, secret: string | Buffer): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** When a session that starts now ends, in milliseconds since the epoch. */
export function sessionExpiry(now = Date.now()): number {
  return now + SESSION_MAX_AGE_SECONDS * 1000;
}

export function signSession(payload: ResponderSession | StaffSession, secret: string | Buffer): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

/**
 * The session in a token, or null when the token is missing, malformed,
 * tampered with, expired or issued for another role.
 */
export function verifySession<R extends SessionRole>(
  token: string | undefined,
  secret: string | Buffer,
  role: R,
  now = Date.now(),
): SessionByRole[R] | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const given = Buffer.from(signature);
  const expected = Buffer.from(mac(body, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const parsed = Payload.safeParse(json);
  if (!parsed.success || parsed.data.role !== role || parsed.data.exp <= now) return null;
  return parsed.data as SessionByRole[R];
}

/* ---------- Secret ---------- */

let cachedSecret: Buffer | undefined;

/**
 * The signing secret from settings. The first call on a fresh database creates
 * it. The database loads here and not at the top of the file, so the token
 * functions above can be imported in a test without opening a file.
 */
export async function getSessionSecret(): Promise<Buffer> {
  if (cachedSecret) return cachedSecret;
  const { readOrCreateSetting } = await import("./settings");
  cachedSecret = Buffer.from(readOrCreateSetting("session_secret", () => randomBytes(32).toString("hex")), "hex");
  return cachedSecret;
}

/* ---------- Cookies ---------- */

/** Secure only over HTTPS. SPEC keeps plain HTTP on the local network as a fallback. */
function isHttps(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return forwarded ? forwarded === "https" : new URL(request.url).protocol === "https:";
}

function cookieOptions(request: Request) {
  return { httpOnly: true, sameSite: "lax", path: "/", secure: isHttps(request) } as const;
}

export function setSessionCookie(response: NextResponse, request: Request, role: SessionRole, token: string) {
  response.cookies.set(SESSION_COOKIE[role], token, { ...cookieOptions(request), maxAge: SESSION_MAX_AGE_SECONDS });
}

export function clearSessionCookie(response: NextResponse, request: Request, role: SessionRole) {
  response.cookies.set(SESSION_COOKIE[role], "", { ...cookieOptions(request), maxAge: 0 });
}

/* ---------- Guards for route handlers ---------- */

/** The session in a cookie value, checked against the stored secret. */
export async function readSession<R extends SessionRole>(role: R, token: string | undefined) {
  if (!token) return null;
  return verifySession(token, await getSessionSecret(), role);
}

async function currentSession<R extends SessionRole>(role: R) {
  return readSession(role, (await cookies()).get(SESSION_COOKIE[role])?.value);
}

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * The responder session, only while the responder is still active. Sign in
 * rejects inactive responders, and this ends a session that outlives a switch
 * off, so it does not wait for the 12 h cookie to run out.
 */
export async function readActiveResponder(token: string | undefined) {
  const session = await readSession("responder", token);
  if (!session) return null;
  const { isActiveResponder } = await import("./responders");
  return isActiveResponder(session.responder_id) ? session : null;
}

async function activeResponderSession() {
  return readActiveResponder((await cookies()).get(SESSION_COOKIE.responder)?.value);
}

export async function requireResponder(): Promise<ResponderSession | Response> {
  return (await activeResponderSession()) ?? unauthorized();
}

export async function requireStaff(): Promise<StaffSession | Response> {
  return (await currentSession("staff")) ?? unauthorized();
}

export async function requireResponderOrStaff(): Promise<ResponderSession | StaffSession | Response> {
  return (await activeResponderSession()) ?? (await currentSession("staff")) ?? unauthorized();
}
