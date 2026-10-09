import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FamilyVoiceNote } from "@/components/responder/family-voice-note";
import { concernText, needLabel } from "@/components/responder/report-detail-labels";
import { ReportDistance } from "@/components/responder/report-distance";
import { StartAssessment } from "@/components/responder/start-assessment";
import { buttonVariants } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import { TopBar } from "@/components/ui/top-bar";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { ReportCode, routes } from "@/lib/contracts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// A house that was visited, could not be assessed or was merged is not
// assessed again from its report. The same rule is a 409 in POST /api/entries.
const OPEN_STATUSES = ["waiting", "assigned", "on_the_way"];

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

  const concern = concernText(report.hurt, report.missing);
  const place = report.purok ? `${report.barangay}, ${report.purok}` : report.barangay;
  const home = report.lat !== null && report.lng !== null ? { lat: report.lat, lng: report.lng } : null;
  const isOpen = OPEN_STATUSES.includes(report.status);
  const hasNote = report.voice_path !== null || report.transcript !== null || report.transcript_en !== null;

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

        <div className="mt-6 grid grid-cols-3">
          <Count value={report.people} label="People" />
          <Count value={report.hurt} label="Hurt" danger={report.hurt > 0} />
          <Count value={report.missing} label="Missing" danger={report.missing > 0} />
        </div>

        {report.needs.length > 0 ? (
          <ul aria-label="Needs" className="mt-6 flex flex-wrap gap-2">
            {report.needs.map((need) => (
              <li key={need}>
                <Pill>{needLabel(need)}</Pill>
              </li>
            ))}
          </ul>
        ) : null}

        {hasNote ? (
          <div className="mt-6">
            <FamilyVoiceNote
              reportId={report.id}
              hasAudio={report.voice_path !== null}
              transcript={report.transcript}
              english={report.transcript_en}
            />
          </div>
        ) : null}
      </main>
      <footer className="sticky bottom-0 bg-canvas px-gutter pb-4 pt-2">
        {isOpen ? <StartAssessment code={report.code} /> : null}
        {/* The sheet is BYT-53. Until it is built this link opens the report with the sheet asked for. */}
        <Link
          href={`${routes.responder.report(report.code)}?sheet=cant-assess`}
          className={cn(buttonVariants({ variant: "tertiary" }), "mt-2 w-full")}
        >
          Can&apos;t assess
        </Link>
      </footer>
    </div>
  );
}
