import { requireStaff } from "@/lib/auth/session";
import { readHubStatus } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The HubStatus contract. MDRRMO staff only, see SPEC section 4. */
export async function GET() {
  const session = await requireStaff();
  if (session instanceof Response) return session;
  return Response.json(await readHubStatus(), { headers: { "Cache-Control": "no-store" } });
}
