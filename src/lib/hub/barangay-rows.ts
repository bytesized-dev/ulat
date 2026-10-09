import type { BarangayRow } from "../contracts/schemas";

/**
 * The barangays worth a row: at least one confirmed entry or one open report.
 * The summary lists every barangay in settings, so most rows are all zeros.
 * A confirmed entry always has a damage class, so the three class counts add up
 * to the confirmed entries. This is for display only: the order is kept, and
 * the map shading and Go first read the full list.
 */
export function barangaysWithData(rows: BarangayRow[]): BarangayRow[] {
  return rows.filter((r) => r.totally + r.partially + r.none > 0 || r.waiting > 0);
}
