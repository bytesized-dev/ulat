import { toWav } from "@/lib/audio/to-wav";
import { AiVoiceExtract } from "@/lib/contracts";

// Pure parts of the voice note screen: the limits, the timer text, the request
// to the hub and what counts as a note we could not read. The screen and the
// recorder hook only wire them to the page.

/** The longest note. The recorder stops itself here, and the hub caps by size too. */
export const MAX_NOTE_SECONDS = 30;

/** Bars in the live waveform. */
export const WAVEFORM_BARS = 30;

/** Anything smaller is a tap on the button, not a note. Real notes are tens of KB. */
export const MIN_AUDIO_BYTES = 1000;

/** A little longer than the hub's own 60 second model timeout. */
const REQUEST_TIMEOUT_MS = 65_000;

/** 14 seconds is "0:14". */
export function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Chrome and Android record webm, Safari on iPhone records mp4.
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** The first format this browser can record, or undefined to let it choose. */
export function pickMimeType(isSupported: (mime: string) => boolean): string | undefined {
  return MIME_TYPES.find((mime) => isSupported(mime));
}

/**
 * Turns a getUserMedia failure into what the screen shows. A denied or missing
 * microphone is the "Microphone is off" screen. Anything else, such as another
 * app holding the microphone, is a note we could not record.
 */
export function micFailure(error: unknown): "blocked" | "failed" {
  const name = error instanceof DOMException ? error.name : "";
  return name === "NotAllowedError" || name === "SecurityError" || name === "NotFoundError" ? "blocked" : "failed";
}

export type VoiceResult = { ok: true; extract: AiVoiceExtract } | { ok: false };

/**
 * Sends the recording to the hub and checks what comes back. Never throws.
 * A failed request, a reply that is not an AiVoiceExtract and an empty
 * transcript all give the same answer, because the family sees one retry screen.
 * The model only reads WAV, so the recording is converted first. The caller
 * keeps the original for playback.
 */
export async function readVoiceNote(audio: Blob, send: typeof fetch = fetch, convert: (recording: Blob) => Promise<Blob> = toWav): Promise<VoiceResult> {
  if (audio.size < MIN_AUDIO_BYTES) return { ok: false };
  try {
    const body = new FormData();
    body.set("audio", await convert(audio), "note.wav");
    const res = await send("/api/ai/voice", { method: "POST", body, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) return { ok: false };
    const extract = AiVoiceExtract.safeParse(await res.json().catch(() => null));
    if (!extract.success || extract.data.transcript.trim() === "") return { ok: false };
    return { ok: true, extract: extract.data };
  } catch {
    return { ok: false };
  }
}

/** The playback bar fills in twelfths of its width. */
export const PROGRESS_STEPS = 12;

/** How many twelfths of the bar are filled at this point in the recording. 0 when the length is unknown. */
export function progressStep(at: number, length: number): number {
  if (!(length > 0)) return 0;
  return Math.round(Math.min(1, Math.max(0, at / length)) * PROGRESS_STEPS);
}

/** How many heights a waveform bar can take, from the shortest to the tallest. */
export const BAR_STEPS = 9;

/** The height step for a level from 0 to 1. Out of range levels stay at the ends. */
export function barStep(level: number): number {
  return Math.round(Math.min(1, Math.max(0, level)) * (BAR_STEPS - 1));
}
