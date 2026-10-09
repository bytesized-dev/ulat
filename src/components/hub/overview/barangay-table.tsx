import type { BarangayRow } from "@/lib/contracts";
import { rowsWithData } from "@/lib/hub/barangay-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriorityPill } from "./priority-pill";

const NUMBERS: { key: keyof Pick<BarangayRow, "totally" | "partially" | "families" | "people" | "hurt" | "waiting">; label: string }[] = [
  { key: "totally", label: "Totally" },
  { key: "partially", label: "Partially" },
  { key: "families", label: "Families" },
  { key: "people", label: "People" },
  { key: "hurt", label: "Hurt" },
  { key: "waiting", label: "Waiting" },
];

const head = "h-auto px-0 pb-3 text-caption font-medium text-muted-text";
const row = "border-hairline-soft hover:bg-transparent";

function RowsTable({ rows }: { rows: BarangayRow[] }) {
  return (
    <Table className="mt-4 text-body-md">
      <TableHeader>
        <TableRow className={row}>
          <TableHead className={head}>Barangay</TableHead>
          {NUMBERS.map(({ key, label }) => (
            <TableHead key={key} className={`${head} text-right`}>
              {label}
            </TableHead>
          ))}
          <TableHead className={`${head} pl-4`}>Priority</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.barangay} className={`${row} h-14`}>
            <TableCell className="px-0 font-semibold text-ink">{r.barangay}</TableCell>
            {NUMBERS.map(({ key }) => (
              <TableCell key={key} className="px-0 text-right font-mono text-mono-sm text-ink">
                {r[key]}
              </TableCell>
            ))}
            <TableCell className="pr-0 pl-4">
              <PriorityPill priority={r.priority} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** One row per barangay with a confirmed entry or an open report, in the order the summary query ranks them. */
export function BarangayTable({ rows }: { rows: BarangayRow[] }) {
  const shown = rowsWithData(rows);
  return (
    <section aria-labelledby="by-barangay">
      <h2 id="by-barangay" className="text-title-md text-ink">
        By barangay
      </h2>
      {shown.length === 0 ? <p className="mt-4 text-body-md text-muted-text">No reports yet</p> : <RowsTable rows={shown} />}
    </section>
  );
}
