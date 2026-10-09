import type { z } from "zod";
import type { ConfirmedDamageClass, EntryStatus, Need } from "@/lib/contracts/schemas";
import type { StatusDotTone } from "@/components/ui/status-dot";
import type { ComparedField, FieldValue } from "@/lib/hub/entries";

type Damage = z.infer<typeof ConfirmedDamageClass>;

/** Short words for the list, long ones for the detail page. */
export const damageShort: Record<Damage, string> = { total: "Totally", partial: "Partially", none: "No damage" };
export const damageLong: Record<Damage | "unclear", string> = {
  total: "Totally damaged",
  partial: "Partially damaged",
  none: "No damage",
  unclear: "Unclear",
};

/** Red and amber for damage, gray for none. The dot sits next to text that says the same thing. */
export const damageTone: Record<Damage, StatusDotTone> = { total: "danger", partial: "warning", none: "muted-soft" };

export const statusLabel: Record<z.infer<typeof EntryStatus>, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  confirmed: "Confirmed",
};

const needLabel: Record<z.infer<typeof Need>, string> = {
  water: "Water",
  food: "Food",
  tarp: "Tarp",
  medicine: "Medicine",
  hygiene_kit: "Hygiene kit",
  baby_needs: "Baby needs",
};

export const fieldLabel: Record<ComparedField, string> = {
  damage_class: "Damage",
  material: "Material",
  people: "People",
  hurt: "Hurt",
  needs: "Needs",
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A value as the table shows it, such as "Totally damaged" or "Water, tarp". */
export function formatValue(field: ComparedField, value: FieldValue): string {
  if (value === null || value === "") return "None";
  if (field === "damage_class") return damageLong[value as Damage | "unclear"] ?? String(value);
  if (field === "needs") {
    const needs = value as string[];
    if (needs.length === 0) return "None";
    // "Water, tarp, medicine": only the first word is capitalised.
    return capitalise(needs.map((n) => (needLabel[n as keyof typeof needLabel] ?? n).toLowerCase()).join(", "));
  }
  if (typeof value === "string") return capitalise(value);
  return String(value);
}

/** 231 becomes "0231". */
export const entryNumber = (n: number) => String(n).padStart(4, "0");
