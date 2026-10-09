import { Pill } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import { formatTime } from "@/lib/time";
import {
  ASSESSMENT_CLASS_LABELS,
  ASSESSMENT_CLASS_TONE,
  URGENCY_LABELS,
  URGENCY_TONE,
  type AssessmentView,
} from "@/lib/reports/assessment";
import { confidenceWords } from "./entry-form";

// The hub's reading of the family photo, under the photo: the damage it sees,
// hazards, the urgency code worked out from it, and the staff verdict when
// there is one. It is a hint before the visit and starts the assess screen.
// The responder's say is the entry they confirm on site, so this card has no
// buttons: only staff change the reading or run it again.
function PhotoAssessment({ view }: { view: AssessmentView }) {
  const { ai, verdict } = view;
  return (
    <section aria-labelledby="photo-assessment" className="mt-4 flex flex-col gap-3 rounded-xl bg-surface-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="photo-assessment" className="text-title-sm text-ink">
          Photo assessment
        </h2>
        {view.urgency ? <Pill dot={URGENCY_TONE[view.urgency] ?? undefined}>{URGENCY_LABELS[view.urgency]}</Pill> : null}
      </div>

      {view.reading ? (
        <p role="status" className="text-body-sm text-body">
          The hub is reading the photo. This takes about 20 seconds.
        </p>
      ) : view.unread && !verdict ? (
        <p className="text-body-sm text-body">The hub has not read this photo yet.</p>
      ) : (
        <>
          {view.damage_class ? (
            <p className="flex items-center gap-2 text-body-md font-semibold text-ink">
              <StatusDot tone={ASSESSMENT_CLASS_TONE[view.damage_class]} />
              {ASSESSMENT_CLASS_LABELS[view.damage_class]}
            </p>
          ) : null}
          {verdict ? (
            <p className="text-body-sm text-body">
              Checked by {verdict.by}
              {verdict.at ? `, ${formatTime(verdict.at)}` : ""}.{verdict.note ? ` ${verdict.note}` : ""}
            </p>
          ) : null}
          {ai ? (
            <p className="text-body-sm text-body">
              {verdict ? `The AI said ${ASSESSMENT_CLASS_LABELS[ai.damage_class].toLowerCase()}. ` : ""}
              {ai.reason}
              {verdict ? "" : ` ${confidenceWords(ai.confidence)}.`}
            </p>
          ) : null}
          {ai && ai.hazards.length > 0 ? (
            <ul aria-label="Hazards in the photo" className="flex flex-wrap gap-2">
              {ai.hazards.map((hazard) => (
                <li key={hazard}>
                  <Pill dot="danger">{hazard}</Pill>
                </li>
              ))}
            </ul>
          ) : null}
          {view.why && !verdict ? <p className="text-body-sm text-muted-text">{view.why}</p> : null}
        </>
      )}

    </section>
  );
}

export { PhotoAssessment };
