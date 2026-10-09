import type { ReportDraft } from "@/components/family/report-draft";

/**
 * The household a link asks for. `/report?for=neighbor` opens the report for a
 * neighbor's house and `/report?for=family` opens the family's own. Anything
 * else, including a repeated or unknown value, means the link asks for nothing
 * and the page shows the household the saved draft holds.
 */
export function parseFor(value: string | string[] | undefined): ReportDraft["source"] | null {
  if (value === "neighbor") return "neighbor";
  if (value === "family") return "family";
  return null;
}
