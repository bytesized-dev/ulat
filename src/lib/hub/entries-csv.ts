import { asc, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import { entries, reports, responders } from "../../db/schema";

// docs/SPEC.md section 7. One row per confirmed entry. Drafts and entries
// that wait for review are left out, the same rule the totals follow.

export const ENTRY_CSV_COLUMNS = [
  "Entry number",
  "Household head",
  "Barangay",
  "Purok",
  "Damage class",
  "People",
  "Hurt",
  "Missing",
  "Needs",
  "Material",
  "Hazards",
  "Responder",
  "Confirmed at",
  "Linked report code",
  "Latitude",
  "Longitude",
] as const;

export type EntryCsvRow = {
  number: number;
  household_head: string | null;
  barangay: string;
  purok: string | null;
  damage_class: string | null;
  people: number;
  hurt: number;
  missing: number;
  needs: string[];
  material: string | null;
  hazards: string[];
  responder: string | null;
  confirmed_at: string | null;
  report_code: string | null;
  lat: number | null;
  lng: number | null;
};

/** Confirmed entries in entry number order, with the responder's name and the linked report code. */
export function loadEntryCsvRows(db: Db): EntryCsvRow[] {
  return db
    .select({
      number: entries.number,
      household_head: entries.household_head,
      barangay: entries.barangay,
      purok: entries.purok,
      damage_class: entries.damage_class,
      people: entries.people,
      hurt: entries.hurt,
      missing: entries.missing,
      needs: entries.needs,
      material: entries.material,
      hazards: entries.hazards,
      responder: responders.name,
      confirmed_at: entries.confirmed_at,
      report_code: reports.code,
      lat: entries.lat,
      lng: entries.lng,
    })
    .from(entries)
    .leftJoin(responders, eq(entries.responder_id, responders.id))
    .leftJoin(reports, eq(entries.report_id, reports.id))
    .where(eq(entries.status, "confirmed"))
    .orderBy(asc(entries.number))
    .all();
}

/**
 * One cell. Text that starts with a character a spreadsheet reads as a formula
 * gets a leading apostrophe, because household names come from families. Cells
 * with a comma, quote or line break are quoted, and quotes inside are doubled.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const csvLine = (cells: (string | number | null | undefined)[]) => cells.map(csvCell).join(",");

/** The CSV text for these rows, header first, lines ended with CRLF. */
export function buildEntriesCsv(rows: EntryCsvRow[]): string {
  const lines = [
    csvLine([...ENTRY_CSV_COLUMNS]),
    ...rows.map((r) =>
      csvLine([
        String(r.number).padStart(4, "0"),
        r.household_head,
        r.barangay,
        r.purok,
        r.damage_class,
        r.people,
        r.hurt,
        r.missing,
        r.needs.join("; "),
        r.material,
        r.hazards.join("; "),
        r.responder,
        r.confirmed_at,
        r.report_code,
        r.lat,
        r.lng,
      ]),
    ),
  ];
  return lines.join("\r\n") + "\r\n";
}
