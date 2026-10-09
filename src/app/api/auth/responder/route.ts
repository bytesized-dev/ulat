import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { responders } from "@/db/schema";
import { attemptKey, beginAttempt, endAttempt, retryAfterSeconds } from "@/lib/auth/limiter";
import { clearSessionCookie, getSessionSecret, sessionExpiry, setSessionCookie, signSession } from "@/lib/auth/session";
import { ResponderSignIn } from "@/lib/contracts";
import { verifyPin } from "@/lib/pin";

// A well formed hash nobody's password produces. An unknown email, or a
// responder with no password yet, is checked against it, so the response takes
// as long as a real check and does not show which emails exist.
const NO_ACCOUNT_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(32)}`;

export async function POST(request: Request) {
  // Count the attempt before the first await, or a batch of parallel requests
  // is all checked before any of them is counted.
  const key = attemptKey("responder", request.headers);
  if (!beginAttempt(key)) {
    const wait = retryAfterSeconds(key);
    return NextResponse.json({ error: "too_many_tries", retry_after: wait }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  let result: "wrong" | "right" | "none" = "none";
  try {
    const body = ResponderSignIn.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    // The contract has trimmed and lower cased the email, the way it is stored.
    const responder = db
      .select()
      .from(responders)
      .where(and(eq(responders.active, true), eq(responders.email, body.data.email)))
      .get();
    const passwordOk = await verifyPin(body.data.password, responder?.password_hash ?? NO_ACCOUNT_HASH);

    if (!responder?.password_hash || !passwordOk) {
      result = "wrong";
      return NextResponse.json({ error: "wrong_email_or_password" }, { status: 401 });
    }

    result = "right";
    const token = signSession(
      { role: "responder", responder_id: responder.id, name: responder.name, exp: sessionExpiry() },
      await getSessionSecret(),
    );
    const response = NextResponse.json({ responder: { id: responder.id, name: responder.name } });
    setSessionCookie(response, request, "responder", token);
    return response;
  } finally {
    endAttempt(key, result);
  }
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response, request, "responder");
  return response;
}
