import { eq, inArray } from "drizzle-orm";
import { CheckIcon, ChevronRightIcon, EyeIcon } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CLASS_SHORT, CLASS_TONE, peopleLine, urgencyLabel } from "@/components/responder/entry-form";
import { orderToVisit, urgencyRank, withDistance } from "@/components/responder/to-visit-order";
import { buttonVariants } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Row } from "@/components/ui/row";
import { StatusDot } from "@/components/ui/status-dot";
import { TopBar } from "@/components/ui/top-bar";
import { db } from "@/db/client";
import { entries, reports } from "@/db/schema";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts";
import { reportUrgency, URGENCY_LABELS } from "@/lib/reports/assessment";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// "Not yet visited" in docs/SPEC.md section 6.
const OPEN_STATUSES = ["waiting", "assigned", "on_the_way"] as const;

const householdName = (head: string | null) => (head ? (/household$/i.test(head) ? head : `${head} household`) : "Unnamed household");

export default async function ConfirmedPage({ params }: { params: Promise<{ entryId: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  if (!(await readActiveResponder(token))) redirect(routes.responder.signIn);
  const { entryId } = await params;

  const entry = db.select().from(entries).where(eq(entries.id, entryId)).get();
  if (!entry) notFound();

  const ownCode = entry.report_id ? db.select({ code: reports.code }).from(reports).where(eq(reports.id, entry.report_id)).get()?.code : null;
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
      ai_class: reports.ai_class,
      ai_hazards: reports.ai_hazards,
      verdict_class: reports.verdict_class,
      verdict_urgency: reports.verdict_urgency,
    })
    .from(reports)
    .where(inArray(reports.status, OPEN_STATUSES))
    .all()
    .filter((r) => r.code !== ownCode)
    .map((r) => ({ ...r, urgency: reportUrgency(r) }));

  // The same order as the To visit list. The server has no position for the
  // responder, so the most urgent house leads and the oldest report breaks a tie.
  const next = orderToVisit(withDistance(open, null), "urgent").find((r) => urgencyRank(r) >= 2) ?? null;
  const tag = next ? (urgencyLabel(next.hurt, next.missing) ?? (next.urgency ? URGENCY_LABELS[next.urgency] : null)) : null;
  const damage = entry.damage_class;
  // A held entry does not count yet, so it must not read as confirmed.
  const held = entry.status === "needs_review";

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar as="p" title="" leading={{ kind: "close", href: routes.responder.toVisit }} />
      <main className="flex flex-1 flex-col gap-8 px-gutter pt-6 pb-6">
        <div className="flex flex-col items-center gap-5">
          {held ? (
            <span className="flex size-18 items-center justify-center rounded-full bg-hairline-soft text-ink">
              <EyeIcon aria-hidden="true" className="size-9" />
            </span>
          ) : (
            <span className="flex size-18 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <CheckIcon aria-hidden="true" className="size-9" />
            </span>
          )}
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-title-page text-ink">{held ? "Sent for a second look" : "Entry confirmed"}</h1>
            {held ? <p className="text-body-md text-body">Staff at the hub will check it before it counts.</p> : null}
          </div>
        </div>
        <div className="flex flex-col">
          <Row
            label={peopleLine(entry.people, entry.hurt)}
            value={householdName(entry.household_head)}
            className="[&>span:first-child]:flex-col-reverse"
            trailing={
              damage ? (
                <Pill dot={CLASS_TONE[damage]}>{CLASS_SHORT[damage]}</Pill>
              ) : null
            }
          />
          {next ? (
            <Row
              href={routes.responder.report(next.code)}
              label="Next urgent"
              value={householdName(next.household_head)}
              // Row drops its chevron when it has a trailing slot, so the page draws it.
              trailing={
                tag ? (
                  <span className="flex items-center gap-1.5 text-caption-strong text-danger">
                    <StatusDot tone="danger" />
                    {tag}
                    <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-muted-soft" />
                  </span>
                ) : null
              }
              chevron
            />
          ) : null}
        </div>
      </main>
      <footer className="flex flex-col gap-3 px-gutter pb-6">
        {next ? (
          <Link href={routes.responder.report(next.code)} className={cn(buttonVariants(), "w-full")}>
            Go to next
          </Link>
        ) : null}
        <Link href={routes.responder.toVisit} className={cn(buttonVariants({ variant: next ? "secondary" : "primary" }), "w-full")}>
          Back to list
        </Link>
      </footer>
    </div>
  );
}
