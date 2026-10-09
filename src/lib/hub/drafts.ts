// One translation field on the post updates screen. `fromAi` stays true while
// the text is an AI draft nobody has touched. Staff always read the drafts
// before posting (docs/SPEC.md section 5), so a field staff typed in is theirs:
// a new draft never overwrites it.

export type DraftField = { text: string; fromAi: boolean };

export const emptyDraft: DraftField = { text: "", fromAi: false };

/** Puts a new AI draft in the field, unless staff have written there. */
export function mergeDraft(field: DraftField, draft: string): DraftField {
  if (field.text.trim() === "" || field.fromAi) return { text: draft, fromAi: true };
  return field;
}

/** Staff typed in the field, so it is no longer an AI draft. */
export function editDraft(text: string): DraftField {
  return { text, fromAi: false };
}
