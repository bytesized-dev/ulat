import { NextResponse } from "next/server";
import { beginAttempt, clientKey, endAttempt, retryAfterSeconds } from "@/lib/auth/limiter";
import { clearSessionCookie, getSessionSecret, sessionExpiry, setSessionCookie, signSession } from "@/lib/auth/session";
import { readSetting } from "@/lib/auth/settings";
import { StaffSignIn } from "@/lib/contracts";
import { verifyPin } from "@/lib/pin";

export async function POST(request: Request) {
  // Count the attempt before the first await, or a batch of parallel requests
  // is all checked before any of them is counted.
  const key = clientKey(request.headers);
  if (!beginAttempt(key)) {
    const wait = retryAfterSeconds(key);
    return NextResponse.json({ error: "too_many_tries", retry_after: wait }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  let result: "wrong" | "right" | "none" = "none";
  try {
    const body = StaffSignIn.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    const hash = readSetting("staff_pin_hash");
    if (!hash) return NextResponse.json({ error: "hub_not_set_up" }, { status: 503 });

    if (!(await verifyPin(body.data.pin, hash))) {
      result = "wrong";
      return NextResponse.json({ error: "wrong_pin" }, { status: 401 });
    }

    result = "right";
    const token = signSession({ role: "staff", exp: sessionExpiry() }, await getSessionSecret());
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, request, "staff", token);
    return response;
  } finally {
    endAttempt(key, result);
  }
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response, request, "staff");
  return response;
}
