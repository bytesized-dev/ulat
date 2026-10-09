import type { z } from "zod";
import type { Need as NeedSchema } from "@/lib/contracts";

type Need = z.infer<typeof NeedSchema>;

const NEED_LABELS: Record<Need, string> = {
  water: "Water",
  food: "Food",
  tarp: "Tarp",
  medicine: "Medicine",
  hygiene_kit: "Hygiene kit",
  baby_needs: "Baby needs",
};

export function needLabel(need: Need): string {
  return NEED_LABELS[need];
}

/** "1 hurt", "2 hurt, 1 missing", or null when nobody is hurt or missing. */
export function concernText(hurt: number, missing: number): string | null {
  const parts: string[] = [];
  if (hurt > 0) parts.push(`${hurt} hurt`);
  if (missing > 0) parts.push(`${missing} missing`);
  return parts.length > 0 ? parts.join(", ") : null;
}
