import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/responder/sign-in-form";
import { db } from "@/db/client";
import { responders } from "@/db/schema";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts";

// Reads the responder list on every request, so a new or switched off
// responder shows up without a rebuild.
export const dynamic = "force-dynamic";

export default async function ResponderSignInPage() {
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  if (await readSession("responder", token)) redirect(routes.responder.toVisit);

  const names = db
    .select({ name: responders.name })
    .from(responders)
    .where(eq(responders.active, true))
    .all()
    .map((r) => r.name);

  return <SignInForm names={names} />;
}
