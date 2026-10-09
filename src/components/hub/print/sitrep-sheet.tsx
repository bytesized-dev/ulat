import { Pill } from "@/components/ui/pill";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { barangaysWithData } from "@/lib/hub/barangay-rows";
import { listedNeeds, NEED_LABELS } from "@/lib/hub/needs";
import { hazardSentence, type PrintReport } from "@/lib/hub/print";
import { formatDate, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PrintSheet } from "./print-sheet";

const sectionTitle = "text-title-sm text-ink";
const num = "font-mono text-mono-sm text-ink tabular";
const head = "h-8 px-0 text-right text-caption text-muted-text first:text-left";

/** Past this many barangays the rows tighten, so the table still fits the page. */
const DENSE_AFTER = 10;

/** The numbered situation report on one A4 sheet. The totals are the saved snapshot. */
export function SitrepSheet({ report }: { report: PrintReport }) {
  const { sitrep, town, simulation, hazards, hazardsReadAt } = report;
  const s = sitrep.snapshot;
  const needs = listedNeeds(s.needs);
  const barangays = barangaysWithData(s.barangays);
  const dense = barangays.length > DENSE_AFTER;
  const row = dense ? "h-7" : "h-10";
  const cell = cn("px-0 text-right font-mono text-mono-sm text-ink tabular", row);
  const label = cn("px-0 text-body-sm text-ink", row);

  const stats = [
    { label: "Houses checked", value: s.houses_checked },
    { label: "Families", value: s.families },
    { label: "Hurt", value: s.hurt },
    { label: "Missing", value: s.missing },
  ];

  return (
    <PrintSheet aria-labelledby="sitrep-title" className="gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <p className="text-body-sm text-body">{`Municipality of ${town}, MDRRMO`}</p>
          {simulation ? <Pill dot="warning">Simulation</Pill> : null}
        </div>
        <h1 id="sitrep-title" className="text-display-lg text-ink">{`Situation report no. ${sitrep.number}`}</h1>
        <p className="text-body-sm text-body">{`${formatTime(sitrep.created_at)}, ${formatDate(sitrep.created_at)}`}</p>
      </header>

      <dl className="grid grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 rounded-lg bg-surface-soft px-4 py-3">
            <dt className="text-caption text-body">{stat.label}</dt>
            <dd className="font-mono text-mono-md text-ink tabular">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="by-barangay" className="flex flex-col gap-1">
        <h2 id="by-barangay" className={sectionTitle}>
          By barangay
        </h2>
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
            {barangays.map((b) => (
              <TableRow key={b.barangay} className="border-hairline-soft hover:bg-transparent">
                <TableCell className={label}>{b.barangay}</TableCell>
                <TableCell className={cell}>{b.families}</TableCell>
                <TableCell className={cell}>{b.people}</TableCell>
                <TableCell className={cell}>{b.totally}</TableCell>
                <TableCell className={cell}>{b.partially}</TableCell>
                <TableCell className={cell}>{b.hurt}</TableCell>
                <TableCell className={cell}>{b.missing}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="border-ink bg-transparent">
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell className={cn(label, "font-semibold")}>Total</TableCell>
              <TableCell className={cell}>{s.families}</TableCell>
              <TableCell className={cell}>{s.people}</TableCell>
              <TableCell className={cell}>{s.totally}</TableCell>
              <TableCell className={cell}>{s.partially}</TableCell>
              <TableCell className={cell}>{s.hurt}</TableCell>
              <TableCell className={cell}>{s.missing}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>

      <section aria-labelledby="damaged" className="flex flex-col gap-1">
        <h2 id="damaged" className={sectionTitle}>
          Damaged houses
        </h2>
        <p className="text-body-sm text-body">
          <span className={num}>{s.totally}</span> totally, <span className={num}>{s.partially}</span> partially,{" "}
          <span className={num}>{s.none}</span> no damage.
        </p>
      </section>

      <section aria-labelledby="needs" className="flex flex-col gap-1">
        <h2 id="needs" className={sectionTitle}>
          Needs
        </h2>
        <p className="text-body-sm text-body">
          {needs.length === 0
            ? "None listed."
            : needs.map((n, i) => (
                <span key={n.need}>
                  {i > 0 ? " " : ""}
                  {NEED_LABELS[n.need]} <span className={num}>{n.households}</span>.
                </span>
              ))}
        </p>
      </section>

      <section aria-labelledby="not-visited" className="flex flex-col gap-1">
        <h2 id="not-visited" className={sectionTitle}>
          Not yet visited
        </h2>
        <p className="text-body-sm text-body">
          <span className={num}>{s.not_yet_visited}</span> family reports.
        </p>
      </section>

      <section aria-labelledby="hazards" className="flex flex-col gap-1">
        <h2 id="hazards" className={sectionTitle}>
          Hazards now
        </h2>
        <p className="text-caption text-muted-text">
          {`Read when you open this page, at ${formatTime(hazardsReadAt)}, ${formatDate(hazardsReadAt)}. Not saved with the report.`}
        </p>
        <p className="text-body-sm text-body">{hazards.length === 0 ? "None listed." : hazardSentence(hazards)}</p>
      </section>

      <div className="mt-auto flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-10 pt-10">
          {["Prepared by", "Noted by, MDRRMO head"].map((role) => (
            <div key={role} className="flex flex-col gap-1 border-t border-ink pt-2">
              <p className="text-body-sm text-body">{role}</p>
            </div>
          ))}
        </div>
        <footer className="flex items-center justify-between gap-4 border-t border-hairline-soft pt-3 text-caption text-muted-text">
          <span>Made with Ulat. Confirmed entries only.</span>
          <span>Page 1 of 1</span>
        </footer>
      </div>
    </PrintSheet>
  );
}
