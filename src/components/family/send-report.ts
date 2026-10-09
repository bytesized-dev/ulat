import { z } from "zod";
import { Need, PhotoStored, ReportCode, VoiceStored, type NewReport } from "@/lib/contracts";
import { toNewReport, type ReportDraft } from "./report-draft";
import { voiceFileName } from "./voice-audio";

// Pure parts of the send screen: what the family sees in the summary, the
// request to the hub and what they read when it fails. The screen only wires
// them to the page.

export const NEED_LABELS: Record<z.infer<typeof Need>, string> = {
  water: "Water",
  food: "Food",
  tarp: "Tarp",
  medicine: "Medicine",
  hygiene_kit: "Hygiene kit",
  baby_needs: "Baby needs",
};

export type SummaryPill = { label: string; dot?: "danger" };

/** The household, where it is and the numbers a family confirms before sending. */
export function summarizeDraft(draft: ReportDraft) {
  const place = [draft.barangay, draft.purok].map((part) => part.trim()).filter(Boolean);
  const pills: SummaryPill[] = [{ label: draft.people === 1 ? "1 person" : `${draft.people} people` }];
  if (draft.hurt > 0) pills.push({ label: `${draft.hurt} hurt`, dot: "danger" });
  if (draft.missing > 0) pills.push({ label: `${draft.missing} missing`, dot: "danger" });
  for (const need of draft.needs) pills.push({ label: NEED_LABELS[need] });
  return { household: draft.household_head.trim(), place: place.join(", "), pills };
}

/** `unreachable` means the hub never answered, so the report can wait on the phone. */
export type SendResult = { ok: true; code: string } | { ok: false; message: string; retry: boolean; unreachable?: boolean };

const UNREACHABLE = "Could not reach the hub. Check the Wi-Fi and try again.";
const CHECK_REPORT = "We could not send your report. Go back and check it.";

/** What the family reads when a report cannot be sent, and whether sending again can help. */
function failure(status: number): { message: string; retry: boolean } {
  if (status === 400 || status === 413) return { message: CHECK_REPORT, retry: false };
  if (status === 429) return { message: "Too many tries. Wait a minute and try again.", retry: true };
  return { message: "The hub could not save your report. Try again.", retry: true };
}

/** True when the draft has everything the hub needs. */
export function canSend(draft: ReportDraft): boolean {
  return toNewReport(draft).success;
}

const Created = z.object({ code: ReportCode });

/** Posts a NewReport to the hub. Never throws. */
export async function postReport(body: NewReport, send: typeof fetch = fetch): Promise<SendResult> {
  try {
    const res = await send("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // The proxy answers 502 or 504 when the hub app behind it is down or too slow.
    if (res.status === 502 || res.status === 504) return { ok: false, message: UNREACHABLE, retry: true, unreachable: true };
    if (!res.ok) return { ok: false, ...failure(res.status) };
    const created = Created.safeParse(await res.json().catch(() => null));
    // The hub answered without a code, so there is nothing to show. Treat it as a failed send.
    if (!created.success) return { ok: false, ...failure(500) };
    return { ok: true, code: created.data.code };
  } catch {
    return { ok: false, message: UNREACHABLE, retry: true, unreachable: true };
  }
}

/** `unreachable` means the hub never answered, so the recording can wait on the phone with its report. */
export type VoiceUpload = { ok: true } | { ok: false; unreachable: boolean };

/**
 * Sends a recording to the hub under the voice_id the report will carry. The
 * hub answers the same for a repeat, so sending it again after a lost reply
 * stores one file. Never throws.
 */
export async function uploadVoice(audio: Blob, voiceId: string, send: typeof fetch = fetch): Promise<VoiceUpload> {
  try {
    const form = new FormData();
    form.set("voice_id", voiceId);
    form.set("audio", audio, voiceFileName(audio));
    const res = await send("/api/reports/voice", { method: "POST", body: form });
    if (res.status === 502 || res.status === 504) return { ok: false, unreachable: true };
    if (!res.ok) return { ok: false, unreachable: false };
    const stored = VoiceStored.safeParse(await res.json().catch(() => null));
    return stored.success && stored.data.voice_id === voiceId ? { ok: true } : { ok: false, unreachable: false };
  } catch {
    return { ok: false, unreachable: true };
  }
}

/** `unreachable` means the hub never answered, so the photo can wait on the phone with its report. */
export type PhotoUpload = { ok: true } | { ok: false; unreachable: boolean };

/** A file name for the upload and the queue, from the photo's type. The hub never reads it. */
export function photoFileName(photo: Blob): string {
  const kind = photo.type.split(";")[0].split("/")[1]?.replace(/[^a-z0-9]/gi, "");
  return `photo.${kind || "jpg"}`;
}

/**
 * Sends a photo to the hub under the photo_id the report will carry. The hub
 * answers the same for a repeat, so sending it again after a lost reply stores
 * one file. Never throws.
 */
export async function uploadPhoto(photo: Blob, photoId: string, send: typeof fetch = fetch): Promise<PhotoUpload> {
  try {
    const form = new FormData();
    form.set("photo_id", photoId);
    form.set("photo", photo, photoFileName(photo));
    const res = await send("/api/reports/photo", { method: "POST", body: form });
    if (res.status === 502 || res.status === 504) return { ok: false, unreachable: true };
    if (!res.ok) return { ok: false, unreachable: false };
    const stored = PhotoStored.safeParse(await res.json().catch(() => null));
    return stored.success && stored.data.photo_id === photoId ? { ok: true } : { ok: false, unreachable: false };
  } catch {
    return { ok: false, unreachable: true };
  }
}

/** The photo a family picked and the photo_id it will go under. The id is made once per tap on Send. */
export type PhotoToSend = { blob: Blob; id: string };

/**
 * Sends the draft to the hub as a NewReport with consent true. Never throws, and
 * never touches the draft, so a failed send leaves it for another try. The
 * clientId is made once per tap on Send and reused if the report is queued.
 *
 * A recording goes first, so the report can name it. The report wins over the
 * recording: if the hub answers but refuses the audio, the report goes without
 * it, because the transcript is already in the report and a house in need
 * should not wait on an attachment. If the hub does not answer, nothing is
 * sent and the caller queues the report with its audio.
 *
 * A photo goes the same way, after the recording and before the report, under
 * the id the caller made for this tap. The draft has no photo field, so the
 * photo and its id come from the caller. The hub refusing the photo sends the
 * report with photo_id null, and an unreachable hub sends nothing.
 */
export async function sendReport(
  draft: ReportDraft,
  send: typeof fetch = fetch,
  clientId?: string,
  audio: Blob | null = null,
  photo: PhotoToSend | null = null,
): Promise<SendResult> {
  const body = toNewReport(draft);
  if (!body.success) return { ok: false, message: CHECK_REPORT, retry: false };
  let voiceId = audio ? body.data.voice_id : null;
  if (audio && voiceId) {
    const upload = await uploadVoice(audio, voiceId, send);
    if (!upload.ok && upload.unreachable) return { ok: false, message: UNREACHABLE, retry: true, unreachable: true };
    if (!upload.ok) voiceId = null;
  }
  let photoId = photo ? photo.id : null;
  if (photo) {
    const upload = await uploadPhoto(photo.blob, photo.id, send);
    if (!upload.ok && upload.unreachable) return { ok: false, message: UNREACHABLE, retry: true, unreachable: true };
    if (!upload.ok) photoId = null;
  }
  return postReport({ ...body.data, voice_id: voiceId, photo_id: photoId, ...(clientId ? { client_id: clientId } : {}) }, send);
}
