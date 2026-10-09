import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DraftingView } from "@/components/responder/drafting-view";
import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export default async function DraftingPage({ params }: { params: Promise<{ entryId: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  if (!(await readActiveResponder(token))) redirect(routes.responder.signIn);
  const { entryId } = await params;
  // Only a draft is being drafted. A confirmed or held entry has its own screen.
  const entry = db.select({ status: entries.status }).from(entries).where(eq(entries.id, entryId)).get();
  if (entry && entry.status !== "draft") redirect(routes.responder.confirmed(entryId));
  return <DraftingView entryId={entryId} />;
}
