import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FieldComparison } from "@/lib/hub/entries";
import { fieldLabel, formatValue } from "./labels";

const head = "h-10 px-0 pr-6 text-caption text-muted-text";
const cell = "h-12.5 px-0 pr-6 text-body-md";

/** The AI draft next to the final entry. The last column says who changed a field, or None. */
export function DraftComparison({ rows }: { rows: FieldComparison[] }) {
  return (
    <Table>
      <TableHeader className="[&_tr]:border-hairline">
        <TableRow className="hover:bg-transparent">
          <TableHead className={head}>Field</TableHead>
          <TableHead className={head}>AI draft</TableHead>
          <TableHead className={head}>Final</TableHead>
          <TableHead className={`${head} pr-0`}>Changed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.field} className="border-hairline-soft hover:bg-transparent">
            <TableCell className={`${cell} text-body`}>{fieldLabel[row.field]}</TableCell>
            <TableCell className={`${cell} text-body`}>{formatValue(row.field, row.draft)}</TableCell>
            <TableCell className={`${cell} font-semibold text-ink`}>{formatValue(row.field, row.final)}</TableCell>
            <TableCell className={`${cell} pr-0 ${row.changed ? "text-ink" : "text-muted-text"}`}>
              {row.changed ? (row.changed_by ?? "Edited") : "None"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
