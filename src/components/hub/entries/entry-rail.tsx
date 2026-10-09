import { MapView, type MapPin } from "@/components/map";
import { Timeline } from "@/components/ui/timeline";
import { formatTime } from "@/lib/time";
import type { EntryDetail } from "@/lib/hub/entries";
import { damageLong } from "./labels";

// About 450 m across, close enough to see the street the house is on.
const REACH = 0.004;

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  const id = `rail-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id={id} className="text-title-md text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Location({ entry }: { entry: EntryDetail["entry"] }) {
  const { lat, lng, damage_class: damage } = entry;
  const caption = [entry.barangay, entry.purok].filter(Boolean).join(", ");
  const accuracy = entry.gps_accuracy_m === null ? "" : ` GPS ${Math.round(entry.gps_accuracy_m)} m.`;
  // "none" has no pin on the map, so a house with no damage is shown by the middle of the view.
  const pins: MapPin[] =
    lat !== null && lng !== null && (damage === "total" || damage === "partial")
      ? [{ id: "entry", kind: damage, label: `${entry.household_head ?? "House"}, ${damageLong[damage].toLowerCase()}`, lat, lng }]
      : [];

  return (
    <Section title="Location">
      {lat !== null && lng !== null ? (
        <MapView
          layout="hub"
          label={`Map of ${caption}`}
          bbox={[lng - REACH, lat - REACH, lng + REACH, lat + REACH]}
          pins={pins}
          selectedId={pins[0]?.id}
          zoomControls={false}
          className="h-45 print:hidden"
        />
      ) : (
        <p className="flex h-45 items-center justify-center rounded-lg bg-surface-soft text-body-sm text-body">No location saved</p>
      )}
      <p className="text-caption text-muted-text">{`${caption}.${accuracy}`}</p>
    </Section>
  );
}

const row = "flex items-center justify-between border-b border-hairline-soft py-3 text-body-sm last:border-b-0";

function FamilyReport({ report }: { report: NonNullable<EntryDetail["report"]> }) {
  return (
    <Section title="Family report" aside={<span className="font-mono text-mono-sm text-muted-text">{report.code}</span>}>
      <dl>
        <div className={row}>
          <dt className="text-body">Sent by</dt>
          <dd className="text-ink">{report.reporter_name ?? "Not given"}</dd>
        </div>
        <div className={row}>
          <dt className="text-body">Counts</dt>
          <dd className="text-ink">{report.counts_match ? "Match" : "Differs"}</dd>
        </div>
      </dl>
    </Section>
  );
}

/** The right rail: where the house is, the family report it answers, and the history of the entry. */
export function EntryRail({ detail }: { detail: EntryDetail }) {
  return (
    <div className="flex flex-col gap-9">
      <Location entry={detail.entry} />
      {detail.report ? <FamilyReport report={detail.report} /> : null}
      <Section title="History">
        {detail.history.length === 0 ? (
          <p className="text-body-sm text-body">Nothing recorded yet.</p>
        ) : (
          <Timeline items={detail.history.map((h) => ({ label: h.label, time: formatTime(h.at), state: "done" }))} />
        )}
      </Section>
    </div>
  );
}
