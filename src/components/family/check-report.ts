import { z } from "zod";
import { Need, routes, VoiceField } from "@/lib/contracts";
import { markChecked, type ReportDraft } from "./report-draft";
import { NEED_LABELS } from "./send-report";

// Pure parts of the check screen: what each row says, which fields still carry
// the Please check marker and how an edit changes the draft. The screen only
// wires them to the page.

type Field = z.infer<typeof VoiceField>;
type NeedName = z.infer<typeof Need>;
type CountField = "people" | "hurt" | "missing";

/** The needs in the order the design shows them. */
export const NEED_OPTIONS = Need.options.map((value) => ({ value, label: NEED_LABELS[value] }));

/** True when there is nothing to check yet, so the screen sends the family back to the start. */
export function isBlankDraft(draft: ReportDraft): boolean {
  return draft.household_head.trim() === "" && draft.barangay.trim() === "" && draft.transcript.trim() === "";
}

/**
 * Where Back goes from the check screen: the Details step the draft came from,
 * the voice note or the typed one. A draft with neither goes to the start.
 */
export function checkBackHref(draft: ReportDraft): string {
  if (isBlankDraft(draft)) return routes.family.report;
  if (draft.spoken) return routes.family.voice;
  return draft.transcript.trim() !== "" ? routes.family.type : routes.family.report;
}

/** True when the model was not sure about the field and the family has not touched it. */
export function needsCheck(draft: ReportDraft, field: Field): boolean {
  return draft.uncertain_fields.includes(field);
}

const NOT_SET = "Not set";

/** The three household rows, in the words the design uses. */
export function householdRows(draft: ReportDraft) {
  const place = [draft.barangay, draft.purok].map((part) => part.trim()).filter(Boolean);
  const near = draft.purok.trim() || draft.barangay.trim();
  return {
    head: draft.household_head.trim() || NOT_SET,
    barangay: place.join(", ") || NOT_SET,
    location: draft.lat !== null && draft.lng !== null && near ? `Near ${near}` : NOT_SET,
  };
}

/** What the family said happened, or a prompt when the note had no damage in it. */
export function whatHappened(draft: ReportDraft): string {
  return draft.what_happened.trim() || NOT_SET;
}

/** The longest values the draft accepts, so the edit sheet can stop the input there. */
export const EDIT_LIMITS = { household_head: 120, purok: 60, what_happened: 200 } as const;

/** A new head of household. Editing it clears its Please check marker. */
export function setHead(draft: ReportDraft, head: string): ReportDraft {
  return markChecked({ ...draft, household_head: head.trim().slice(0, EDIT_LIMITS.household_head) }, "household_head");
}

/** A new barangay and purok. The model never fills these, so there is no marker to clear. */
export function setPlace(draft: ReportDraft, barangay: string, purok: string): ReportDraft {
  return { ...draft, barangay, purok: purok.trim().slice(0, EDIT_LIMITS.purok) };
}

/** A new account of what happened. Editing it clears its Please check marker. */
export function setWhatHappened(draft: ReportDraft, text: string): ReportDraft {
  return markChecked({ ...draft, what_happened: text.trim().slice(0, EDIT_LIMITS.what_happened) }, "what_happened");
}

/** A change to one of the three counters. Editing it clears its Please check marker. */
export function setCount(draft: ReportDraft, field: CountField, value: number): ReportDraft {
  return markChecked({ ...draft, [field]: value }, field);
}

/** Turns one need on or off. Editing the needs clears their Please check marker. */
export function setNeed(draft: ReportDraft, need: NeedName, on: boolean): ReportDraft {
  const rest = draft.needs.filter((n) => n !== need);
  // Keep the design's order, so the saved list does not depend on the order of the taps.
  const needs = Need.options.filter((n) => (n === need ? on : rest.includes(n)));
  return markChecked({ ...draft, needs }, "needs");
}
