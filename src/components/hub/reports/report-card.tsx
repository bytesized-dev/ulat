import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { HubSummary } from "@/lib/contracts";
import { formatDate, formatTime } from "@/lib/time";

const NEED_LABELS: Record<keyof HubSummary["needs"], string> = {
  water: "Water",
  food: "Food",
  tarp: "Tarp",
  medicine: "Medicine",
  hygiene_kit: "Hygiene kit",
  baby_needs: "Baby needs",
};

const head = "h-10 px-0 text-right text-caption text-muted-text first:text-left";
const cell = "h-12 px-0 text-right font-mono text-mono-sm text-ink tabular";
const sectionTitle = "text-title-sm text-ink";

/** Needs with at least one household, in the order of the contract. */
function listedNeeds(needs: HubSummary["needs"]) {
  return (Object.keys(NEED_LABELS) as (keyof typeof NEED_LABELS)[])
    .map((need) => ({ need, households: needs[need] ?? 0 }))
    .filter((n) => n.households > 0);
}

type ReportCardProps = {
  number: number;
  createdAt: string;
  town: string;
  snapshot: HubSummary;
  /** One line per hazard, read live because the snapshot has no hazards. */
  hazards: string[];
};

/** One situation report: the saved snapshot, never the live totals. */
export function ReportCard({ number, createdAt, town, snapshot, hazards }: ReportCardProps) {
  const needs = listedNeeds(snapshot.needs);
  return (
    <article className="flex flex-col gap-9 rounded-lg border border-hairline p-8">
      <header className="flex flex-col gap-2">
        <p className="text-caption text-muted-text">{`Municipality of ${town}, MDRRMO`}</p>
        <h2 className="text-display-md text-ink">{`Situation report no. ${number}`}</h2>
        <p className="font-mono text-mono-sm text-body">{`${formatTime(createdAt)}, ${formatDate(createdAt)}`}</p>
      </header>

      <section aria-labelledby="by-barangay" className="flex flex-col gap-2">
        <h3 id="by-barangay" className={sectionTitle}>
          By barangay
        </h3>
        <Table>
          <TableHeader>
            <TableRow className="border-hairline hover:bg-transparent">
              <TableHead className={head}>Barangay</TableHead>
              <TableHead className={head}>Families</TableHead>
              <TableHead className={head}>People</TableHead>
              <TableHead className={head}>Totally</TableHead>
              <TableHead className={head}>Partially</TableHead>
              <TableHead className={head}>Hurt</TableHead>
              <TableHead className={head}>Missing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshot.barangays.map((b) => (
              <TableRow key={b.barangay} className="border-hairline-soft hover:bg-transparent">
                <TableCell className="h-12 px-0 text-body-sm text-ink">{b.barangay}</TableCell>
                <TableCell className={cell}>{b.families}</TableCell>
                <TableCell className={cell}>{b.people}</TableCell>
                <TableCell className={cell}>{b.totally}</TableCell>
                <TableCell className={cell}>{b.partially}</TableCell>
                <TableCell className={cell}>{b.hurt}</TableCell>
                <TableCell className={cell}>{b.missing}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="border-hairline bg-transparent">
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell className="h-12 px-0 text-body-sm font-semibold text-ink">Total</TableCell>
              <TableCell className={cell}>{snapshot.families}</TableCell>
              <TableCell className={cell}>{snapshot.people}</TableCell>
              <TableCell className={cell}>{snapshot.totally}</TableCell>
              <TableCell className={cell}>{snapshot.partially}</TableCell>
              <TableCell className={cell}>{snapshot.hurt}</TableCell>
              <TableCell className={cell}>{snapshot.missing}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>

      <section aria-labelledby="needs" className="flex flex-col gap-2">
        <h3 id="needs" className={sectionTitle}>
          Needs
        </h3>
        <p className="text-body-sm text-body">
          {needs.length === 0
            ? "None listed."
            : needs.map((n, i) => (
                <span key={n.need}>
                  {i > 0 ? " " : ""}
                  {NEED_LABELS[n.need]} <span className="font-mono text-mono-sm text-ink tabular">{n.households}</span>.
                </span>
              ))}
        </p>
      </section>

      <section aria-labelledby="not-yet-visited" className="flex flex-col gap-2">
        <h3 id="not-yet-visited" className={sectionTitle}>
          Not yet visited
        </h3>
        <p className="text-body-sm text-body">
          <span className="font-mono text-mono-sm text-ink tabular">{snapshot.not_yet_visited}</span> family reports.
        </p>
      </section>

      <section aria-labelledby="hazards" className="flex flex-col gap-2">
        <h3 id="hazards" className={sectionTitle}>
          Hazards now
        </h3>
        <p className="text-caption text-muted-text">Read when you open this page. Not saved with the report.</p>
        <p className="text-body-sm text-body">{hazards.length === 0 ? "None listed." : hazards.map((h) => (h.endsWith(".") ? h : `${h}.`)).join(" ")}</p>
      </section>
    </article>
  );
}
