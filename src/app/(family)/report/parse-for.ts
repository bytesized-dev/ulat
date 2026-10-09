import type { ReportDraft } from "@/components/family/report-draft";

/**
 * The household a link asks for. `/report?for=neighbor` opens the report for a
 * neighbor's house. Anything else, including a repeated or unknown value,
 * means the link asks for nothing and the family picks.
 */
export function parseFor(value: string | string[] | undefined): ReportDraft["source"] | null {
  return value === "neighbor" ? "neighbor" : null;
}
