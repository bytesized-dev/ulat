import { db } from "@/db/client";
import { requireStaff } from "@/lib/auth/session";
import { noStore } from "@/lib/hub/http";
import { createSitrep } from "@/lib/hub/sitreps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Staff snapshot the totals as the next numbered situation report. The totals
 * come from getHubSummary and the SMS from buildSms, never from the model.
 * There is no body to read. Returns the saved report. See SPEC section 7.
 */
export async function POST() {
  const session = await requireStaff();
  if (session instanceof Response) return session;
  return Response.json(createSitrep(db), { status: 201, headers: noStore });
}
