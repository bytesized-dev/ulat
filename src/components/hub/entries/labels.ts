import type { z } from "zod";
import type { ConfirmedDamageClass, EntryStatus } from "@/lib/contracts/schemas";
import type { StatusDotTone } from "@/components/ui/status-dot";

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
  needs_review: "Needs review",
  confirmed: "Confirmed",
};

/** 231 becomes "0231". */
export const entryNumber = (n: number) => String(n).padStart(4, "0");
