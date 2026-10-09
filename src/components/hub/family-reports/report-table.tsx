import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { statusLabel, urgentLabel, type FamilyReportRow } from "@/lib/hub/family-reports";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type ReportTableProps = {
  rows: FamilyReportRow[];
  selected: string | null;
  /** The href that selects a report, keeping the current filter. */
  hrefFor: (code: string) => string;
};

/** "2:55". The rail shows the full "2:55 PM". */
const clock = (iso: string) => formatTime(iso).replace(/ [AP]M$/, "");

const head = "h-auto px-0 pb-3 text-caption text-muted-text";
const cell = "px-0 py-3.5 pr-4 text-body-sm";

// One row per family report. The household is the link that opens the rail,
// stretched over the whole row so any part of it can be clicked.
function ReportTable({ rows, selected, hrefFor }: ReportTableProps) {
  if (rows.length === 0) return <p className="py-8 text-body-md text-body">No reports here.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-hairline-soft hover:bg-transparent">
          <TableHead className={head}>Code</TableHead>
          <TableHead className={head}>Household</TableHead>
          <TableHead className={head}>Barangay</TableHead>
          <TableHead className={head}>Urgent</TableHead>
          <TableHead className={head}>Sent</TableHead>
          <TableHead className={head}>Assigned</TableHead>
          <TableHead className={head}>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const status = statusLabel(row);
          const urgent = urgentLabel(row);
          const current = row.code === selected;
          return (
            <TableRow
              key={row.code}
              className={cn("relative border-hairline-soft hover:bg-surface-soft", current && "bg-surface-soft")}
            >
              <TableCell className={cn(cell, "font-mono text-mono-xs text-muted-text")}>{row.code}</TableCell>
              <TableCell className={cn(cell, "font-semibold text-ink")}>
                <Link
                  href={hrefFor(row.code)}
                  scroll={false}
                  aria-current={current ? "true" : undefined}
                  className="outline-none after:absolute after:inset-0 focus-visible:underline"
                >
                  {row.household_head}
                </Link>
              </TableCell>
              <TableCell className={cn(cell, "text-ink")}>{row.barangay}</TableCell>
              <TableCell className={cn(cell, urgent ? "font-semibold text-danger" : "text-muted-text")}>{urgent ?? "None"}</TableCell>
              <TableCell className={cn(cell, "font-mono text-mono-xs text-muted-text")}>
                <time dateTime={row.created_at}>{clock(row.created_at)}</time>
              </TableCell>
              <TableCell className={cn(cell, row.assigned_name ? "text-ink" : "text-muted-text")}>{row.assigned_name ?? "Not assigned"}</TableCell>
              <TableCell className={cn(cell, "pr-0")}>
                <Pill dot={status.tone}>{status.label}</Pill>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export { ReportTable };
