import { db } from "@/db/client";
import { requireStaff } from "@/lib/auth/session";
import { getHubSummary } from "@/lib/hub/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Totals, per barangay rows, priority and needs for the hub. Every number is
 * computed in SQL by getHubSummary. MDRRMO staff only, see SPEC section 4.
 */
export async function GET() {
  const session = await requireStaff();
  if (session instanceof Response) return session;
  return Response.json(getHubSummary(db), { headers: { "Cache-Control": "no-store" } });
}
