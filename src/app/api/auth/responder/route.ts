import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { responders } from "@/db/schema";
import { blockedSeconds, clientKey, recordFailure, recordSuccess } from "@/lib/auth/limiter";
import { clearSessionCookie, getSessionSecret, sessionExpiry, setSessionCookie, signSession } from "@/lib/auth/session";
import { readSetting } from "@/lib/auth/settings";
import { ResponderSignIn } from "@/lib/contracts";
import { verifyPin } from "@/lib/pin";

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function POST(request: Request) {
  const key = clientKey(request.headers);
  const wait = blockedSeconds(key);
  if (wait > 0) {
    return NextResponse.json({ error: "too_many_tries", retry_after: wait }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  const body = ResponderSignIn.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const hash = readSetting("team_pin_hash");
  if (!hash) return NextResponse.json({ error: "hub_not_set_up" }, { status: 503 });

  const responder = db
    .select()
    .from(responders)
    .where(eq(responders.active, true))
    .all()
    .find((r) => sameName(r.name, body.data.name));
  // The PIN is checked even when the name is unknown, so the response time
  // does not show which names exist.
  const pinOk = await verifyPin(body.data.pin, hash);

  if (!responder || !pinOk) {
    recordFailure(key);
    return NextResponse.json({ error: "wrong_name_or_pin" }, { status: 401 });
  }

  recordSuccess(key);
  const token = signSession(
    { role: "responder", responder_id: responder.id, name: responder.name, exp: sessionExpiry() },
    await getSessionSecret(),
  );
  const response = NextResponse.json({ responder: { id: responder.id, name: responder.name } });
  setSessionCookie(response, request, "responder", token);
  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response, request, "responder");
  return response;
}
