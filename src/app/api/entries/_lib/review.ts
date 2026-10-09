import type { EntryConfirm } from "@/lib/contracts";

// SPEC section 5: an entry goes to needs_review when
// - the responder picks a different class than the AI,
// - the AI said unclear and the responder picks without a new photo,
// - the hurt count differs from the linked family report.

export const REVIEW_REASONS = {
  class_differs: "The class is different from the AI draft.",
  unclear_no_new_photo: "The AI was not sure and there is no new photo.",
  hurt_differs: "The hurt count is different from the family report.",
} as const;

export function reviewReasons(input: {
  aiClass: string | null;
  confirm: Pick<EntryConfirm, "damage_class" | "hurt" | "new_photo_since_unclear">;
  reportHurt: number | null;
}): (keyof typeof REVIEW_REASONS)[] {
  const out: (keyof typeof REVIEW_REASONS)[] = [];
  const { aiClass, confirm, reportHurt } = input;
  if (aiClass === "unclear") {
    if (!confirm.new_photo_since_unclear) out.push("unclear_no_new_photo");
  } else if (aiClass && aiClass !== confirm.damage_class) {
    out.push("class_differs");
  }
  if (reportHurt !== null && reportHurt !== confirm.hurt) out.push("hurt_differs");
  return out;
}
