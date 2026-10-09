import { NextResponse } from "next/server";
import { blockedSeconds, clientKey, recordFailure, recordSuccess } from "@/lib/auth/limiter";
import { clearSessionCookie, getSessionSecret, sessionExpiry, setSessionCookie, signSession } from "@/lib/auth/session";
import { readSetting } from "@/lib/auth/settings";
import { StaffSignIn } from "@/lib/contracts";
import { verifyPin } from "@/lib/pin";

export async function POST(request: Request) {
  const key = clientKey(request.headers);
  const wait = blockedSeconds(key);
  if (wait > 0) {
    return NextResponse.json({ error: "too_many_tries", retry_after: wait }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  const body = StaffSignIn.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const hash = readSetting("staff_pin_hash");
  if (!hash) return NextResponse.json({ error: "hub_not_set_up" }, { status: 503 });

  if (!(await verifyPin(body.data.pin, hash))) {
    recordFailure(key);
    return NextResponse.json({ error: "wrong_pin" }, { status: 401 });
  }

  recordSuccess(key);
  const token = signSession({ role: "staff", exp: sessionExpiry() }, await getSessionSecret());
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, request, "staff", token);
  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response, request, "staff");
  return response;
}
