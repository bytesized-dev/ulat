import type { BarangayRow } from "../contracts/schemas";

// The summary lists every barangay in settings, so the API stays complete for
// the map and for callers that want all of them. The hub table and the printed
// sitrep show only the barangays that have something to say.

/** True when the barangay has a confirmed entry or an open report. Entries are counted by damage class. */
export function hasData(row: BarangayRow): boolean {
  return row.totally + row.partially + row.none + row.waiting > 0;
}

/** The rows worth showing, in the summary's order. */
export function rowsWithData(rows: BarangayRow[]): BarangayRow[] {
  return rows.filter(hasData);
}
