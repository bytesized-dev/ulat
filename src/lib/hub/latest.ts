import { sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { entries, reports } from "../../db/schema";
import { formatTime } from "../time";

// The Latest list on the hub overview. It reads the entries and reports tables
// directly, so it works on the seed, which writes no audit events. Stored times
// carry different offsets, so the ordering goes through julianday, not the text.

export type LatestKind = "entry_confirmed" | "entry_needs_review" | "report_created";

export type LatestItem = {
  id: string;
  kind: LatestKind;
  at: string;
  /** "2:58", hub local time. */
  time: string;
  /** "Garcia household confirmed" */
  text: string;
};

type LatestRow = {
  id: string;
  kind: LatestKind;
  at: string;
  household_head: string | null;
  number: number | null;
  barangay: string;
  hurt: number;
};

/** "Garcia household confirmed", "Entry 0238 needs review", "New report, Santa Cruz, 2 hurt". */
export function latestText(row: Pick<LatestRow, "kind" | "household_head" | "number" | "barangay" | "hurt">): string {
  const entryName = `Entry ${String(row.number ?? 0).padStart(4, "0")}`;
  switch (row.kind) {
    case "entry_confirmed":
      return `${row.household_head?.trim() || entryName} confirmed`;
    case "entry_needs_review":
      return `${entryName} needs review`;
    case "report_created":
      return row.hurt > 0 ? `New report, ${row.barangay}, ${row.hurt} hurt` : `New report, ${row.barangay}`;
  }
}

/** The newest confirmations, entries waiting for review and new family reports. Drafts never show. */
export function getLatest(db: Db, limit = 4): LatestItem[] {
  const rows = db.all<LatestRow>(sql`
    select * from (
      select ${entries.id} as id, 'entry_confirmed' as kind, ${entries.confirmed_at} as at,
        ${entries.household_head} as household_head, ${entries.number} as number, ${entries.barangay} as barangay, ${entries.hurt} as hurt
      from ${entries}
      where ${entries.status} = 'confirmed' and ${entries.confirmed_at} is not null
      union all
      select ${entries.id}, 'entry_needs_review', ${entries.created_at},
        ${entries.household_head}, ${entries.number}, ${entries.barangay}, ${entries.hurt}
      from ${entries}
      where ${entries.status} = 'needs_review'
      union all
      select ${reports.id}, 'report_created', ${reports.created_at},
        ${reports.household_head}, null, ${reports.barangay}, ${reports.hurt}
      from ${reports}
      where ${reports.status} != 'merged'
    )
    order by julianday(at) desc, id asc
    limit ${limit}`);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    at: row.at,
    // The design shows the clock time alone. The whole list is from one day.
    time: formatTime(row.at).replace(/ [AP]M$/, ""),
    text: latestText(row),
  }));
}
