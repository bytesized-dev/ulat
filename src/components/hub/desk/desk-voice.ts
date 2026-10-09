import { AiVoiceExtract } from "@/lib/contracts";

// Pure parts of the desk voice note: the limits, the timer text, the request
// to POST /api/ai/voice and what counts as a note we could not read.

/** The longest note. The recorder stops itself here, and the hub caps by size too. */
export const MAX_NOTE_SECONDS = 30;

/** Anything smaller is a tap on the button, not a note. */
export const MIN_AUDIO_BYTES = 1000;

/** A little longer than the hub's own 60 second model timeout. */
const REQUEST_TIMEOUT_MS = 65_000;

/** 14 seconds is "0:14". */
export function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Chrome records webm, Safari records mp4.
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** The first format this browser can record, or undefined to let it choose. */
export function pickMimeType(isSupported: (mime: string) => boolean): string | undefined {
  return MIME_TYPES.find((mime) => isSupported(mime));
}

/** A denied or missing microphone is "blocked". Anything else, such as another app holding it, is "failed". */
export function micFailure(error: unknown): "blocked" | "failed" {
  const name = error instanceof DOMException ? error.name : "";
  return name === "NotAllowedError" || name === "SecurityError" || name === "NotFoundError" ? "blocked" : "failed";
}

export type VoiceResult = { ok: true; extract: AiVoiceExtract } | { ok: false };

/**
 * Sends the recording to the hub and checks what comes back. Never throws.
 * A failed request, a reply that is not an AiVoiceExtract and an empty
 * transcript all give the same answer: record it again.
 */
export async function readVoiceNote(audio: Blob, send: typeof fetch = fetch): Promise<VoiceResult> {
  if (audio.size < MIN_AUDIO_BYTES) return { ok: false };
  try {
    const body = new FormData();
    body.set("audio", audio, audio.type.includes("mp4") ? "note.m4a" : "note.webm");
    const res = await send("/api/ai/voice", { method: "POST", body, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) return { ok: false };
    const extract = AiVoiceExtract.safeParse(await res.json().catch(() => null));
    if (!extract.success || extract.data.transcript.trim() === "") return { ok: false };
    return { ok: true, extract: extract.data };
  } catch {
    return { ok: false };
  }
}
