import { SESSION_COOKIE } from "@/lib/auth/session";
import { cookieValue } from "@/lib/live/scope";
import { markSeen } from "@/lib/status/phones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The phone offline queues poll this to learn whether the hub is reachable.
 * No auth and no database, so it answers fast. Each hit also counts the phone
 * in the phones number on the hub, except a hit that carries the staff cookie.
 * That is the hub laptop, and Caddy gives it a LAN address that is not
 * loopback. The cookie is only checked for, never verified, because verifying
 * it needs the database. A phone that fakes it just drops itself from the count.
 */
export function GET(request: Request) {
  if (!cookieValue(request, SESSION_COOKIE.staff)) markSeen(request);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
