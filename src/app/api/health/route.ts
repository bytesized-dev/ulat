import { markSeen } from "@/lib/status/phones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The phone offline queues poll this to learn whether the hub is reachable.
 * No auth and no database, so it answers fast. Each hit also counts the phone
 * in the phones number on the hub.
 */
export function GET(request: Request) {
  markSeen(request);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
