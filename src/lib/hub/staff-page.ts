import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts/routes";

/**
 * Staff only, for a hub page that reads data. Call it first, before any read,
 * and the visitor goes to the lock screen when the cookie has no staff session.
 * src/proxy.ts redirects first; this check does not rely on it.
 */
export async function requireStaffPage(): Promise<void> {
  const session = await readSession("staff", (await cookies()).get(SESSION_COOKIE.staff)?.value);
  if (!session) redirect(routes.hub.lock);
}
