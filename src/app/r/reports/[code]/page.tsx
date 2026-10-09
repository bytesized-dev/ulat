import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CantAssessSheet } from "@/components/responder/cant-assess-sheet";
import { FamilyPhoto } from "@/components/responder/family-photo";
import { FamilyVoiceNote } from "@/components/responder/family-voice-note";
import { LiveRefresh } from "@/components/responder/live-refresh";
import { PhotoAssessment } from "@/components/responder/photo-assessment";
import { concernText, needLabel } from "@/components/responder/report-detail-labels";
import { ReportDistance } from "@/components/responder/report-distance";
import { ReportMap } from "@/components/responder/report-map";
import { assignmentLabel, assignmentOf } from "@/components/responder/to-visit-order";
import { buttonVariants } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import { TopBar } from "@/components/ui/top-bar";
import { db } from "@/db/client";
import { photos, reports, responders } from "@/db/schema";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { ReportCode, routes } from "@/lib/contracts";
import { assessmentView } from "@/lib/reports/assessment";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// A house that was visited, could not be assessed or was merged is not assessed
// again from its report, so a second entry cannot count it twice.
const CLOSED_NOTE: Partial<Record<typeof reports.$inferSelect.status, string>> = {
  visited: "Already visited",
  cant_assess: "Marked can't assess",
  merged: "Merged into another report",
};

// Past this length the pill wraps to several lines, so it trades the full capsule for a rounded block.
const WRAP_AT = 28;

function Count({ value, label, danger }: { value: number; label: string; danger?: boolean }) {
  return (
    <div>
      <div className={danger ? "font-mono text-mono-md tabular text-danger" : "font-mono text-mono-md tabular text-ink"}>{value}</div>
      <div className="text-body-sm text-muted-text">{label}</div>
    </div>
  );
}

export default async function FamilyReportPage({ params }: { params: Promise<{ code: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  const session = await readActiveResponder(token);
  if (!session) redirect(routes.responder.signIn);

  const { code: raw } = await params;
  const parsed = ReportCode.safeParse(raw.toUpperCase());
  if (!parsed.success) notFound();
  const report = db.select().from(reports).where(eq(reports.code, parsed.data)).get();
  if (!report) notFound();
  const assignee = report.assigned_to
    ? db.select({ name: responders.name }).from(responders).where(eq(responders.id, report.assigned_to)).get()
    : undefined;
  const assignment = assignmentOf({ assigned_to: report.assigned_to, assignee_name: assignee?.name }, session.responder_id);

  const concern = concernText(report.hurt, report.missing);
  const place = report.purok ? `${report.barangay}, ${report.purok}` : report.barangay;
  const home = report.lat !== null && report.lng !== null ? { lat: report.lat, lng: report.lng } : null;
  const closedNote = CLOSED_NOTE[report.status];
  const whatHappened = report.what_happened?.trim() || null;
  const hasNote = report.transcript !== null || report.transcript_en !== null;
  // The one photo the family sent. /api/files serves it by its photos row.
  const photo = report.photo_path
    ? db.select({ id: photos.id }).from(photos).where(and(eq(photos.report_id, report.id), eq(photos.path, report.photo_path))).get()
    : undefined;
  // The hub's reading of that photo, and whoever set a verdict on it.
  const verdictBy =
    report.verdict_by && report.verdict_by !== "staff"
      ? db.select({ name: responders.name }).from(responders).where(eq(responders.id, report.verdict_by)).get()?.name
      : undefined;
  const assessment = assessmentView(report, (id) => (id === "staff" ? "Hub staff" : (verdictBy ?? "a responder")));

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar as="p" title={report.code} leading={{ kind: "back", href: routes.responder.toVisit }} className="font-mono" />
      <main className="flex-1 px-gutter pb-6 pt-4">
        {concern ? (
          <span className="inline-flex items-center gap-1.5 text-caption-strong text-danger">
            <StatusDot tone="danger" />
            {concern}
          </span>
        ) : null}
        <h1 className="mt-2 text-title-page text-ink">{report.household_head}</h1>
        <ReportDistance place={place} home={home} />
        {assignment ? (
          <Pill dot={assignment.kind === "mine" ? "primary" : undefined} className="mt-3">
            {assignmentLabel(assignment)}
          </Pill>
        ) : null}

        <div className="mt-6 grid grid-cols-3">
          <Count value={report.people} label="People" />
          <Count value={report.hurt} label="Hurt" danger={report.hurt > 0} />
          <Count value={report.missing} label="Missing" danger={report.missing > 0} />
        </div>

        {report.needs.length > 0 || whatHappened ? (
          <ul aria-label="Needs and what happened" className="mt-6 flex flex-wrap gap-2">
            {report.needs.map((need) => (
              <li key={need}>
                <Pill>{needLabel(need)}</Pill>
              </li>
            ))}
            {whatHappened ? (
              <li className="max-w-full">
                {/* Free text up to 200 characters: it wraps inside the row instead of running off the screen. */}
                <Pill className={cn("h-auto min-h-6.5 max-w-full whitespace-normal py-1", whatHappened.length > WRAP_AT && "rounded-xl")}>
                  {whatHappened}
                </Pill>
              </li>
            ) : null}
          </ul>
        ) : null}

        {home ? <ReportMap home={home} household={report.household_head} /> : null}

        {hasNote ? (
          <div className="mt-6">
            <FamilyVoiceNote transcript={report.transcript} english={report.transcript_en} />
          </div>
        ) : null}

        {photo ? (
          <div className="mt-6">
            <FamilyPhoto photoId={photo.id} />
            {assessment ? <PhotoAssessment view={assessment} /> : null}
          </div>
        ) : null}
      </main>
      <footer className="sticky bottom-0 bg-canvas px-gutter pb-4 pt-2">
        {closedNote ? (
          <p className="py-4 text-center text-body-md text-muted-text">{closedNote}</p>
        ) : (
          // The capture screen creates the entry when the responder sends it.
          <div className="flex flex-col gap-1">
            <Link href={`${routes.responder.assess(randomUUID())}?code=${report.code}`} prefetch={false} className={cn(buttonVariants(), "w-full")}>
              Start assessment
            </Link>
            <CantAssessSheet code={report.code} />
          </div>
        )}
      </footer>
      <LiveRefresh />
    </div>
  );
}
