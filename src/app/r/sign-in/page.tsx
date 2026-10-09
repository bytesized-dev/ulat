import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/responder/sign-in-form";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts";

export default async function ResponderSignInPage() {
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  if (await readActiveResponder(token)) redirect(routes.responder.toVisit);

  return <SignInForm />;
}
