import { z } from "zod";
import { Need, NewReport } from "@/lib/contracts";
import { clearReportPhoto } from "./report-photo-store";

// The report a family is filling in, kept in sessionStorage between the three
// steps: household, details, send. Every step reads and writes this one object,
// and the send screen turns it into a NewReport. The family types every field.
// Nothing on the phone goes to the AI.

export const DRAFT_KEY = "ulat.report-draft";

// The field rules come from the NewReport contract, so a change there reaches
// the draft. The draft only differs where a half-filled form needs it: text is
// an empty string instead of null, and barangay may be empty until picked.
const { source, people, lat, lng } = NewReport.shape;

export const ReportDraft = z.object({
  source: source.exclude(["desk"]),
  barangay: z.string().max(120),
  purok: z.string().max(60),
  household_head: z.string().max(120),
  /** Only for a neighbor's report: who is reporting and where to find them. */
  reporter_name: z.string().max(120),
  reporter_where: z.string().max(120),
  lat,
  lng,
  people,
  hurt: people,
  missing: people,
  what_happened: z.string().max(200),
  needs: z.array(Need),
});
export type ReportDraft = z.infer<typeof ReportDraft>;

export function emptyDraft(): ReportDraft {
  return {
    source: "family",
    barangay: "",
    purok: "",
    household_head: "",
    reporter_name: "",
    reporter_where: "",
    lat: null,
    lng: null,
    people: 0,
    hurt: 0,
    missing: 0,
    what_happened: "",
    needs: [],
  };
}

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** sessionStorage in the browser, nothing on the server or in private modes that block it. */
function browserStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The saved draft, or an empty one when nothing valid is stored. */
export function loadDraft(storage: DraftStorage | null = browserStorage()): ReportDraft {
  try {
    const raw = storage?.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = ReportDraft.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyDraft();
  } catch {
    return emptyDraft();
  }
}

/** Merges the change into the saved draft and returns the result. */
export function saveDraft(change: Partial<ReportDraft>, storage: DraftStorage | null = browserStorage()): ReportDraft {
  const next = { ...loadDraft(storage), ...change };
  try {
    storage?.setItem(DRAFT_KEY, JSON.stringify(next));
  } catch {
    // A full or blocked store must not stop the family from sending.
  }
  return next;
}

export function clearDraft(storage: DraftStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
  // The photo is part of the draft, kept apart because it is too big for sessionStorage.
  void clearReportPhoto();
}

/**
 * The draft a refused queued report becomes again, so the family can fix it on
 * the details screen. The inverse of toNewReport: null text turns back into an
 * empty string. A report from the help desk cannot come from a phone, so it
 * falls back to a family report.
 */
export function draftFromReport(report: NewReport): ReportDraft {
  return {
    ...emptyDraft(),
    source: report.source === "neighbor" ? "neighbor" : "family",
    barangay: report.barangay,
    purok: report.purok ?? "",
    household_head: report.household_head,
    reporter_name: report.reporter_name ?? "",
    reporter_where: report.reporter_where ?? "",
    lat: report.lat,
    lng: report.lng,
    people: report.people,
    hurt: report.hurt,
    missing: report.missing,
    what_happened: report.what_happened ?? "",
    needs: report.needs,
  };
}

const orNull = (text: string) => (text.trim() === "" ? null : text.trim());

/**
 * The body for POST /api/reports. Call it only after the family agrees on the
 * send screen. Fails when a required field, such as the household head, is
 * still empty.
 */
export function toNewReport(draft: ReportDraft) {
  const neighbor = draft.source === "neighbor";
  return NewReport.safeParse({
    source: draft.source,
    household_head: draft.household_head,
    reporter_name: neighbor ? orNull(draft.reporter_name) : null,
    reporter_where: neighbor ? orNull(draft.reporter_where) : null,
    barangay: draft.barangay,
    purok: orNull(draft.purok),
    lat: draft.lat,
    lng: draft.lng,
    people: draft.people,
    hurt: draft.hurt,
    missing: draft.missing,
    what_happened: orNull(draft.what_happened),
    needs: draft.needs,
    // Only the help desk records a voice note. A family report has none.
    transcript: null,
    english: null,
    language: null,
    consent: true,
  });
}
