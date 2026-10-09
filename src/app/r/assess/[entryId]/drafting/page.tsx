import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DraftingView } from "@/components/responder/drafting-view";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export default async function DraftingPage({ params }: { params: Promise<{ entryId: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  if (!(await readActiveResponder(token))) redirect(routes.responder.signIn);
  const { entryId } = await params;
  return <DraftingView entryId={entryId} />;
}
