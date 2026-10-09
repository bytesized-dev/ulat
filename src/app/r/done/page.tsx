import { and, desc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DoneList } from "@/components/responder/done-list";
import { LiveRefresh } from "@/components/responder/live-refresh";
import { AppTopBar } from "@/components/ui/app-top-bar";
import { TabBar } from "@/components/ui/tab-bar";
import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts";
import { dayKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function DonePage() {
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  const session = await readActiveResponder(token);
  if (!session) redirect(routes.responder.signIn);

  // Only this responder's own entries, and only what the rows show.
  const mine = db
    .select({
      id: entries.id,
      household_head: entries.household_head,
      damage_class: entries.damage_class,
      ai_need_more: entries.ai_need_more,
      status: entries.status,
      confirmed_at: entries.confirmed_at,
    })
    .from(entries)
    .where(and(eq(entries.responder_id, session.responder_id), inArray(entries.status, ["draft", "needs_review", "confirmed"])))
    .orderBy(desc(entries.created_at))
    .all();

  const today = dayKey(new Date());
  const needsCheck = mine.filter((e) => e.status !== "confirmed");
  const confirmed = mine
    .filter((e) => e.status === "confirmed" && e.confirmed_at && dayKey(e.confirmed_at) === today)
    .sort((a, b) => (b.confirmed_at ?? "").localeCompare(a.confirmed_at ?? ""));

  return (
    <div className="flex min-h-dvh flex-col">
      <AppTopBar name={session.name} searchLabel="Search reports" />
      <main className="flex-1 px-gutter pb-6 pt-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-title-page text-ink">Done</h1>
          <span className="font-mono text-mono-sm text-muted-text">{confirmed.length} today</span>
        </div>
        <DoneList needsCheck={needsCheck} confirmed={confirmed} />
      </main>
      <div className="sticky bottom-0 bg-canvas">
        <TabBar active="done" />
      </div>
      <LiveRefresh />
    </div>
  );
}
