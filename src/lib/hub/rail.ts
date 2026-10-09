import type { z } from "zod";
import { Need as NeedEnum, type BarangayRow, type HubSummary } from "../contracts/schemas";

type Need = z.infer<typeof NeedEnum>;

// Small shaping for the overview rail. The numbers come from the summary query
// as they are; this only picks, orders and words them.

export const NEED_LABELS: Record<Need, string> = {
  water: "Water",
  food: "Food",
  tarp: "Tarp",
  medicine: "Medicine",
  hygiene_kit: "Hygiene kit",
  baby_needs: "Baby needs",
};

/** The first barangays to send a team to: high and medium priority, in the summary's order. */
export function goFirst(rows: BarangayRow[], limit = 3): BarangayRow[] {
  return rows.filter((r) => r.priority !== "low").slice(0, limit);
}

/** "3 hurt, 1 missing", or the totally damaged count when nobody is hurt or missing. */
export function goFirstReason(row: BarangayRow): string {
  const parts = [row.hurt > 0 && `${row.hurt} hurt`, row.missing > 0 && `${row.missing} missing`].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return `${row.totally} totally damaged`;
}

export type NeedBar = { need: Need; label: string; households: number; /** Share of houses checked, 0 to 100. */ percent: number };

/** Needs that at least one household listed, most first, as a share of the houses checked. */
export function needBars(summary: Pick<HubSummary, "needs" | "houses_checked">): NeedBar[] {
  return NeedEnum.options
    .map((need) => ({ need, households: summary.needs[need] ?? 0 }))
    .filter((n) => n.households > 0)
    .sort((a, b) => b.households - a.households)
    .map((n) => ({
      ...n,
      label: NEED_LABELS[n.need],
      percent: summary.houses_checked > 0 ? Math.min(100, Math.round((n.households / summary.houses_checked) * 100)) : 0,
    }));
}
