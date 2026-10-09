import type { HubSummary } from "../contracts";

export const NEED_LABELS: Record<keyof HubSummary["needs"], string> = {
  water: "Water",
  food: "Food",
  tarp: "Tarp",
  medicine: "Medicine",
  hygiene_kit: "Hygiene kit",
  baby_needs: "Baby needs",
};

/** Needs with at least one household, in the order of the contract. */
export function listedNeeds(needs: HubSummary["needs"]) {
  return (Object.keys(NEED_LABELS) as (keyof typeof NEED_LABELS)[])
    .map((need) => ({ need, households: needs[need] ?? 0 }))
    .filter((n) => n.households > 0);
}
