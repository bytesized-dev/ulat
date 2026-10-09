import { z } from "zod";
import { NewReport, Need, ReportCode, SafeCheckin, type AiVoiceExtract } from "@/lib/contracts";

type SafeCheckinBody = z.infer<typeof SafeCheckin>;

// Pure parts of the help desk: the form values, what a voice note fills in,
// the requests to the hub and what staff read when one fails. The screen only
// wires them to the page.

type NeedKey = z.infer<typeof Need>;

export const NEED_OPTIONS: { value: NeedKey; label: string }[] = [
  { value: "water", label: "Water" },
  { value: "food", label: "Food" },
  { value: "tarp", label: "Tarp" },
  { value: "medicine", label: "Medicine" },
  { value: "hygiene_kit", label: "Hygiene kit" },
  { value: "baby_needs", label: "Baby needs" },
];

/** The household report as typed. Counts stay text until the form is saved. */
export type HouseholdForm = {
  name: string;
  barangay: string;
  purok: string;
  people: string;
  hurt: string;
  missing: string;
  what: string;
  needs: NeedKey[];
};

export const emptyHousehold = (): HouseholdForm => ({ name: "", barangay: "", purok: "", people: "", hurt: "0", missing: "0", what: "", needs: [] });

/** What the voice note said, kept so the report carries it. */
export type HeardNote = { transcript: string; english: string; language: AiVoiceExtract["language"] };

const FIELD_LABELS: Record<string, string> = {
  household_head: "name",
  people: "people",
  hurt: "hurt",
  missing: "missing",
  what_happened: "what happened",
  needs: "needs",
};

/** The fields the model was not sure about, in words, for staff to check. */
export function uncertainLabels(extract: AiVoiceExtract): string[] {
  return extract.uncertain_fields.map((field) => FIELD_LABELS[field]).filter(Boolean);
}

/**
 * Puts what a voice note found into the form. A field the note did not
 * mention keeps what staff already typed.
 */
export function applyExtract(form: HouseholdForm, extract: AiVoiceExtract): HouseholdForm {
  const count = (value: number | null, fallback: string) => (value === null ? fallback : String(value));
  return {
    ...form,
    name: extract.household_head?.trim() || form.name,
    people: count(extract.people, form.people),
    hurt: count(extract.hurt, form.hurt),
    missing: count(extract.missing, form.missing),
    what: extract.what_happened?.trim() || form.what,
    needs: extract.needs.length > 0 ? extract.needs : form.needs,
  };
}

/** A whole number from 0 to 99, or null. */
export function parseCount(text: string): number | null {
  const value = text.trim();
  return /^\d{1,2}$/.test(value) ? Number(value) : null;
}

export type HouseholdErrors = Partial<Record<"name" | "barangay" | "people" | "hurt" | "missing", string>>;

const COUNT_ERROR = "Enter 0 to 99";

export function validateHousehold(form: HouseholdForm): HouseholdErrors {
  const errors: HouseholdErrors = {};
  if (form.name.trim() === "") errors.name = "Enter a name";
  if (form.barangay === "") errors.barangay = "Pick a barangay";
  if (parseCount(form.people) === null) errors.people = COUNT_ERROR;
  if (parseCount(form.hurt) === null) errors.hurt = COUNT_ERROR;
  if (parseCount(form.missing) === null) errors.missing = COUNT_ERROR;
  return errors;
}

/**
 * The NewReport for a form that passed validateHousehold. The desk is staff
 * filing for a family in person, so the source is desk and the consent is
 * the staff member's, taken at the desk.
 */
export function toNewReport(form: HouseholdForm, heard: HeardNote | null): NewReport {
  const text = (value: string) => value.trim() || null;
  return {
    source: "desk",
    household_head: form.name.trim(),
    reporter_name: null,
    reporter_where: null,
    barangay: form.barangay,
    purok: text(form.purok),
    lat: null,
    lng: null,
    people: parseCount(form.people) ?? 0,
    hurt: parseCount(form.hurt) ?? 0,
    missing: parseCount(form.missing) ?? 0,
    what_happened: text(form.what),
    needs: form.needs,
    voice_id: null,
    photo_id: null,
    transcript: heard?.transcript ?? null,
    english: heard?.english ?? null,
    language: heard?.language ?? null,
    consent: true,
  };
}

/** The safe list check-in as typed. */
export type SafeForm = { name: string; barangay: string; staying_at: string; message: string };

export const emptySafe = (): SafeForm => ({ name: "", barangay: "", staying_at: "", message: "" });

export type SafeErrors = Partial<Record<"name" | "barangay" | "staying_at", string>>;

export function validateSafe(form: SafeForm): SafeErrors {
  const errors: SafeErrors = {};
  if (form.name.trim() === "") errors.name = "Enter a name";
  if (form.barangay === "") errors.barangay = "Pick a barangay";
  if (form.staying_at.trim() === "") errors.staying_at = "Enter where they are";
  return errors;
}

export function toSafeCheckin(form: SafeForm): SafeCheckinBody {
  return {
    name: form.name.trim(),
    barangay: form.barangay,
    staying_at: form.staying_at.trim(),
    message: form.message.trim() || null,
    source: "desk",
  };
}

export type SaveResult<T extends object = object> = ({ ok: true } & T) | { ok: false; message: string };

const SIGNED_OUT = "The hub is locked. Unlock it and try again.";
const CHECK_FORM = "The hub could not read the form. Check the fields and try again.";
const UNREACHABLE = "Could not reach the hub. Try again.";

function failureMessage(status: number): string {
  if (status === 401 || status === 403) return SIGNED_OUT;
  if (status === 400 || status === 413) return CHECK_FORM;
  if (status === 429) return "Too many tries. Wait a minute and try again.";
  return "The hub could not save it. Try again.";
}

async function post(url: string, body: unknown, send: typeof fetch): Promise<Response | null> {
  try {
    return await send(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return null;
  }
}

const Created = z.object({ code: ReportCode });

/** Files a desk report with POST /api/reports. Never throws. */
export async function saveReport(report: NewReport, send: typeof fetch = fetch): Promise<SaveResult<{ code: string }>> {
  const res = await post("/api/reports", report, send);
  if (!res) return { ok: false, message: UNREACHABLE };
  if (!res.ok) return { ok: false, message: failureMessage(res.status) };
  const created = Created.safeParse(await res.json().catch(() => null));
  return created.success ? { ok: true, code: created.data.code } : { ok: false, message: failureMessage(500) };
}

/** Checks someone in with POST /api/safe. Never throws. */
export async function saveCheckin(checkin: SafeCheckinBody, send: typeof fetch = fetch): Promise<SaveResult> {
  const res = await post("/api/safe", checkin, send);
  if (!res) return { ok: false, message: UNREACHABLE };
  return res.ok ? { ok: true } : { ok: false, message: failureMessage(res.status) };
}
