import { formatTime } from "@/lib/time";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SafeRow } from "./fetch-safe";

const head = "h-10 px-0 text-caption text-muted-text";
const cell = "h-12.5 px-0 text-body-sm text-ink";

/** Name, barangay, where they are staying and when they checked in. Never the message. */
export function SafeTable({ rows, empty }: { rows: SafeRow[]; empty: string }) {
  if (rows.length === 0) return <p className="border-t border-hairline-soft py-6 text-body-sm text-body">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-hairline hover:bg-transparent">
          <TableHead className={head}>Name</TableHead>
          <TableHead className={head}>Barangay</TableHead>
          <TableHead className={head}>Staying at</TableHead>
          <TableHead className={head}>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.name}-${row.at}`} className="border-hairline-soft hover:bg-transparent">
            <TableCell className={`${cell} font-semibold`}>{row.name}</TableCell>
            <TableCell className={cell}>{row.barangay}</TableCell>
            <TableCell className={cell}>{row.staying_at}</TableCell>
            <TableCell className={`${cell} font-mono text-mono-xs text-body`}>{formatTime(row.at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
