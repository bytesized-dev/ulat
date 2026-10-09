import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { routes } from "@/lib/contracts/routes";
import { formatTime } from "@/lib/time";
import type { EntryListRow } from "@/lib/hub/entries";
import { damageShort, damageTone, entryNumber } from "./labels";

const head = "h-10 px-0 pr-6 text-caption text-muted-text";
const cell = "px-0 py-0 pr-6 text-body-md text-ink";
const mono = "font-mono text-mono-sm tabular";

/** One row per confirmed entry. The household name is the link, stretched over the whole row. */
export function EntriesTable({ rows }: { rows: EntryListRow[] }) {
  return (
    <Table className="text-body-md">
      <TableHeader className="[&_tr]:border-hairline">
        <TableRow className="hover:bg-transparent">
          <TableHead className={head}>Entry</TableHead>
          <TableHead className={head}>Household</TableHead>
          <TableHead className={head}>Barangay</TableHead>
          <TableHead className={head}>Damage</TableHead>
          <TableHead className={`${head} text-right`}>People</TableHead>
          <TableHead className={`${head} text-right`}>Hurt</TableHead>
          <TableHead className={`${head} pl-6`}>Responder</TableHead>
          <TableHead className={`${head} pr-0`}>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} className="relative h-14 border-hairline-soft hover:bg-surface-soft">
            <TableCell className={`${cell} text-muted-text ${mono}`}>{entryNumber(row.number)}</TableCell>
            <TableCell className={`${cell} font-semibold`}>
              <Link
                href={routes.hub.entry(row.id)}
                className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
              >
                {row.household_head ?? "Household"}
              </Link>
            </TableCell>
            <TableCell className={cell}>{row.barangay}</TableCell>
            <TableCell className={cell}>
              {row.damage_class ? (
                <Pill dot={damageTone[row.damage_class]}>{damageShort[row.damage_class]}</Pill>
              ) : null}
            </TableCell>
            <TableCell className={`${cell} text-right ${mono}`}>{row.people}</TableCell>
            <TableCell className={`${cell} text-right ${mono}`}>{row.hurt}</TableCell>
            <TableCell className={`${cell} pl-6`}>{row.responder}</TableCell>
            <TableCell className={`${cell} pr-0 text-muted-text ${mono}`}>
              {row.confirmed_at ? formatTime(row.confirmed_at) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
