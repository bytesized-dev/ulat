import { inArray } from "drizzle-orm";
import { PlusIcon } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LiveRefresh } from "@/components/responder/live-refresh";
import { ToVisitList } from "@/components/responder/to-visit-list";
import { buttonVariants } from "@/components/ui/button";
import { TabBar } from "@/components/ui/tab-bar";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts";
import { cn } from "@/lib/utils";

// Reads the reports on every request. LiveRefresh asks for a fresh render when
// a report is created or changes.
export const dynamic = "force-dynamic";

// "Not yet visited" in docs/SPEC.md section 6.
const OPEN_STATUSES = ["waiting", "assigned", "on_the_way"] as const;

export default async function ToVisitPage() {
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  const session = await readActiveResponder(token);
  if (!session) redirect(routes.responder.signIn);

  // Only what the list shows. Phone numbers, notes and transcripts stay in the database.
  const open = db
    .select({
      code: reports.code,
      household_head: reports.household_head,
      barangay: reports.barangay,
      purok: reports.purok,
      lat: reports.lat,
      lng: reports.lng,
      hurt: reports.hurt,
      missing: reports.missing,
      created_at: reports.created_at,
    })
    .from(reports)
    .where(inArray(reports.status, OPEN_STATUSES))
    .all();

  return (
    <div className="flex min-h-dvh flex-col">
      <ToVisitList responderName={session.name} reports={open} />
      <div className="sticky bottom-0 bg-canvas">
        <footer className="px-gutter pb-4 pt-2">
          <Link href={routes.responder.newHouse} className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
            <PlusIcon aria-hidden="true" />
            New house
          </Link>
        </footer>
        <TabBar active="toVisit" />
      </div>
      <LiveRefresh />
    </div>
  );
}
