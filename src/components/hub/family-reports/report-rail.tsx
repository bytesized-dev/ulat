import { FamilyPhoto } from "@/components/responder/family-photo";
import { Pill } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import { urgentLabel, type FamilyReportRow } from "@/lib/hub/family-reports";
import { ASSESSMENT_CLASS_LABELS, ASSESSMENT_CLASS_TONE, assessmentView, URGENCY_LABELS, URGENCY_TONE } from "@/lib/reports/assessment";
import { formatTime } from "@/lib/time";
import { AssessmentForm } from "./assessment-form";
import { AssignForm } from "./assign-form";

type ReportRailProps = {
  report: FamilyReportRow | null;
  responders: { id: string; name: string }[];
};

// The selected report: who, where, when, what the family said, who to send, then the
// hub's reading of their photo with staff's own verdict.
function ReportRail({ report, responders }: ReportRailProps) {
  if (!report) return <p className="text-body-sm text-body">Pick a report to see it here.</p>;

  const urgent = urgentLabel(report);
  const said = report.transcript ?? report.what_happened;
  const assessment = assessmentView(report, (id) => (id === "staff" ? "Hub staff" : (report.verdict_name ?? "a responder")));

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
        <p className="text-caption text-muted-text">{report.transcript ? "Voice note" : "Note"}</p>
        <p className="text-body-sm text-ink">{said ?? "No note."}</p>
      </div>

      <AssignForm
        key={report.code}
        code={report.code}
        responders={responders}
        assignedTo={report.assigned_to}
        sent={report.status === "assigned" || report.status === "on_the_way"}
        done={report.status === "visited"}
      />

      {assessment && report.photo_id ? (
        <section aria-labelledby="rail-assessment" className="flex flex-col gap-3">
          <h3 id="rail-assessment" className="text-title-sm text-ink">
            Photo assessment
          </h3>
          <FamilyPhoto key={report.photo_id} photoId={report.photo_id} />
          {assessment.reading ? (
            <p role="status" className="text-body-sm text-body">
              The hub is reading the photo. This takes about 20 seconds.
            </p>
          ) : assessment.unread && !assessment.verdict ? (
            <p className="text-body-sm text-body">The hub has not read this photo yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {assessment.damage_class ? (
                  <p className="flex items-center gap-2 text-body-md font-semibold text-ink">
                    <StatusDot tone={ASSESSMENT_CLASS_TONE[assessment.damage_class]} />
                    {ASSESSMENT_CLASS_LABELS[assessment.damage_class]}
                  </p>
                ) : null}
                {assessment.urgency ? <Pill dot={URGENCY_TONE[assessment.urgency] ?? undefined}>{URGENCY_LABELS[assessment.urgency]}</Pill> : null}
              </div>
              {assessment.verdict ? (
                <p className="text-body-sm text-body">
                  Checked by {assessment.verdict.by}
                  {assessment.verdict.at ? `, ${formatTime(assessment.verdict.at)}` : ""}.
                  {assessment.verdict.note ? ` ${assessment.verdict.note}` : ""}
                </p>
              ) : null}
              {assessment.ai ? (
                <p className="text-body-sm text-body">
                  {assessment.verdict ? `The AI said ${ASSESSMENT_CLASS_LABELS[assessment.ai.damage_class].toLowerCase()}. ` : "AI reading: "}
                  {assessment.ai.reason}
                </p>
              ) : null}
              {assessment.ai && assessment.ai.hazards.length > 0 ? (
                <ul aria-label="Hazards in the photo" className="flex flex-wrap gap-2">
                  {assessment.ai.hazards.map((hazard) => (
                    <li key={hazard}>
                      <Pill dot="danger">{hazard}</Pill>
                    </li>
                  ))}
                </ul>
              ) : null}
              {assessment.why && !assessment.verdict ? <p className="text-body-sm text-muted-text">{assessment.why}</p> : null}
            </div>
          )}
          <AssessmentForm
            key={`${report.code}-${report.verdict_at ?? ""}-${report.ai_at ?? ""}`}
            code={report.code}
            damageClass={assessment.verdict?.damage_class ?? (assessment.ai && assessment.ai.damage_class !== "unclear" ? assessment.ai.damage_class : null)}
            urgency={assessment.urgency}
            canRunAgain={assessment.canRunAgain}
          />
        </section>
      ) : null}

    </div>
  );
}

export { ReportRail };
