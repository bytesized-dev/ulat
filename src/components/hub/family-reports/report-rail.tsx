import { StatusDot } from "@/components/ui/status-dot";
import { urgentLabel, type FamilyReportRow } from "@/lib/hub/family-reports";
import { formatTime } from "@/lib/time";
import { AssignForm } from "./assign-form";

type ReportRailProps = {
  report: FamilyReportRow | null;
  responders: { id: string; name: string }[];
};

// The selected report: who, where, when, what the family said, and who to send.
function ReportRail({ report, responders }: ReportRailProps) {
  if (!report) return <p className="text-body-sm text-body">Pick a report to see it here.</p>;

  const urgent = urgentLabel(report);
  const said = report.transcript ?? report.what_happened;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="rail-title" className="flex flex-col gap-2">
        <span className="font-mono text-mono-xs text-muted-text">{report.code}</span>
        <h2 id="rail-title" className="text-display-md text-ink">
          {report.household_head}
        </h2>
        {urgent ? (
          <p className="flex items-center gap-2 text-body-sm font-semibold text-danger">
            <StatusDot tone="danger" />
            {urgent}
          </p>
        ) : null}
      </section>

      <div className="flex items-baseline justify-between gap-4 text-body-sm text-body">
        <span>{report.barangay}</span>
        <time dateTime={report.created_at} className="font-mono text-mono-sm text-ink">
          {formatTime(report.created_at)}
        </time>
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-surface-soft p-4">
        <p className="text-caption text-muted-text">{report.has_voice || report.transcript ? "Voice note" : "Note"}</p>
        {report.has_voice ? (
          <audio
            key={report.id}
            controls
            preload="none"
            aria-label={`Voice note from ${report.household_head}`}
            src={`/api/files/${report.id}`}
            className="w-full"
          />
        ) : null}
        <p className="text-body-sm text-ink">{said ?? "No voice note."}</p>
      </div>

      <AssignForm
        key={report.code}
        code={report.code}
        responders={responders}
        assignedTo={report.assigned_to}
        sent={report.status === "assigned" || report.status === "on_the_way"}
        done={report.status === "visited"}
      />
    </div>
  );
}

export { ReportRail };
