import { NewEntryMeta } from "@/lib/contracts";

// Pure helpers for the photos and note screen, kept apart so they can be tested.

export const MAX_PHOTOS = 3;
export const MAX_NOTE_SECONDS = 30;
/** One label per photo slot, in the order the responder takes them. */
export const PHOTO_LABELS = ["Front", "Roof", "Damage"] as const;

export type House = {
  report_code: string | null;
  barangay: string;
  purok: string | null;
  household_head: string | null;
};

export type Gps = { lat: number; lng: number; accuracy_m: number };

/** The label the next photo will get, or null when all slots are used. */
export function nextLabel(count: number): string | null {
  return PHOTO_LABELS[count] ?? null;
}

/** 22 seconds shows as 0:22. Rounds down and never goes past the cap. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.min(Math.floor(seconds), MAX_NOTE_SECONDS));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The GPS line under the note. Accuracy is rounded to whole metres. */
export function gpsText(gps: Gps | null, failed: boolean): string {
  if (gps) return `GPS saved, ${Math.round(gps.accuracy_m)} m`;
  return failed ? "GPS is not available. The entry is sent without a location." : "Finding your location";
}

/** Checks the meta against the shared contract before it is sent. */
export function buildMeta(house: House, labels: string[], gps: Gps | null) {
  return NewEntryMeta.safeParse({
    ...house,
    lat: gps?.lat ?? null,
    lng: gps?.lng ?? null,
    gps_accuracy_m: gps ? gps.accuracy_m : null,
    photo_labels: labels,
  });
}

/** The multipart body that POST /api/entries expects. */
export function buildForm(meta: NewEntryMeta, photos: File[], note: Blob | null): FormData {
  const form = new FormData();
  form.set("meta", JSON.stringify(meta));
  for (const photo of photos) form.append("photos", photo);
  if (note) form.set("note", new File([note], `note.${noteExtension(note.type)}`, { type: note.type }));
  return form;
}

function noteExtension(mime: string): string {
  const base = mime.split(";")[0].trim();
  return base === "audio/mp4" ? "m4a" : (base.split("/")[1] ?? "webm");
}

/** What to tell the responder when POST /api/entries says no. */
export function sendError(status: number, code: string | undefined): string {
  if (status === 401) return "Your session ended. Sign in again.";
  if (code === "photo_count") return "Add one to three photos.";
  if (code === "report_not_found") return "That family report was not found.";
  if (code?.endsWith("_type_not_allowed")) return "That file type is not supported. Take the photo again.";
  if (code?.endsWith("_size_not_allowed")) return "That file is too big. Take it again.";
  return "Could not send to the hub. Try again.";
}
