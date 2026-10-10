import type { z } from "zod";
import { Need, routes } from "@/lib/contracts";
import type { ReportDraft } from "./report-draft";
import { NEED_LABELS } from "./send-report";

// Pure parts of the details screen: what each row says and how an edit changes
// the draft. The family fills every field here by hand, and all of them are
// optional. The screen only wires them to the page.

type NeedName = z.infer<typeof Need>;
type CountField = "people" | "hurt" | "missing";

/** The needs in the order the design shows them. */
export const NEED_OPTIONS = Need.options.map((value) => ({ value, label: NEED_LABELS[value] }));

/** True when the household step was skipped, so the screen sends the family back to the start. */
export function isBlankDraft(draft: ReportDraft): boolean {
  return draft.household_head.trim() === "" && draft.barangay.trim() === "";
}

/** Back from the details screen goes to the household step, which keeps the draft. */
export function checkBackHref(): string {
  return routes.family.report;
}

/** What a row says for something the family has not given yet. */
export const NOT_SET = "Not set";

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

/** What the family said happened, or Not set. */
export function whatHappened(draft: ReportDraft): string {
  return draft.what_happened.trim() || NOT_SET;
}

/** The longest values the draft accepts, so the edit sheet can stop the input there. */
export const EDIT_LIMITS = { household_head: 120, purok: 60, what_happened: 200 } as const;

/** A new head of household. */
export function setHead(draft: ReportDraft, head: string): ReportDraft {
  return { ...draft, household_head: head.trim().slice(0, EDIT_LIMITS.household_head) };
}

/** A new barangay and purok. */
export function setPlace(draft: ReportDraft, barangay: string, purok: string): ReportDraft {
  return { ...draft, barangay, purok: purok.trim().slice(0, EDIT_LIMITS.purok) };
}

/** A new account of what happened. */
export function setWhatHappened(draft: ReportDraft, text: string): ReportDraft {
  return { ...draft, what_happened: text.trim().slice(0, EDIT_LIMITS.what_happened) };
}

/** A change to one of the three counters. */
export function setCount(draft: ReportDraft, field: CountField, value: number): ReportDraft {
  return { ...draft, [field]: value };
}

/** Turns one need on or off. */
export function setNeed(draft: ReportDraft, need: NeedName, on: boolean): ReportDraft {
  const rest = draft.needs.filter((n) => n !== need);
  // Keep the design's order, so the saved list does not depend on the order of the taps.
  const needs = Need.options.filter((n) => (n === need ? on : rest.includes(n)));
  return { ...draft, needs };
}
