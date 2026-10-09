import type { EntryConfirm } from "@/lib/contracts";

// SPEC section 5: an entry goes to needs_review when the hurt count differs
// from the linked family report. No AI reads a responder's photos, so the
// class is the responder's own call and never holds an entry by itself.

export const REVIEW_REASONS = {
  hurt_differs: "The hurt count is different from the family report.",
} as const;

export function reviewReasons(input: {
  confirm: Pick<EntryConfirm, "hurt">;
  reportHurt: number | null;
}): (keyof typeof REVIEW_REASONS)[] {
  const { confirm, reportHurt } = input;
  return reportHurt !== null && reportHurt !== confirm.hurt ? ["hurt_differs"] : [];
}
