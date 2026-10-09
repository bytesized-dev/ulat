import { AiErrorBody, AiVoiceExtract } from "@/lib/contracts";
import { applyExtract, type ReportDraft } from "./report-draft";

// Pure parts of the type instead screen: the limit, the request to the hub and
// what the family reads when it fails. The screen only wires them to the page.

/** Same limit as POST /api/ai/text. */
export const NOTE_LIMIT = 500;

export type NoteResult = { ok: true; extract: AiVoiceExtract } | { ok: false; message: string; retry: boolean };

const CANT_READ = "We could not read your note.";

const MESSAGES: Record<AiErrorBody["error"], string> = {
  bad_request: `${CANT_READ} Check the text and try again.`,
  too_large: `${CANT_READ} It is too long. Shorten it or record instead.`,
  rejected: `${CANT_READ} Shorten it or record instead.`,
  timeout: `${CANT_READ} The hub took too long. Try again.`,
  unavailable: `${CANT_READ} The hub is busy. Try again.`,
  invalid_output: `${CANT_READ} Try again.`,
};

/** Sends the typed note to the hub and checks what comes back. Never throws. */
export async function readNote(text: string, send: typeof fetch = fetch): Promise<NoteResult> {
  try {
    const res = await send("/api/ai/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok) {
      const extract = AiVoiceExtract.safeParse(body);
      if (extract.success) return { ok: true, extract: extract.data };
      return { ok: false, message: MESSAGES.invalid_output, retry: true };
    }
    const failure = AiErrorBody.safeParse(body);
    if (failure.success) return { ok: false, message: MESSAGES[failure.data.error], retry: failure.data.retry };
    return { ok: false, message: MESSAGES.unavailable, retry: true };
  } catch {
    return { ok: false, message: "Could not reach the hub. Check the Wi-Fi and try again.", retry: true };
  }
}

/**
 * The draft after a typed note. The route returns an empty transcript, so the
 * family's own words fill it, and any earlier recording no longer applies.
 */
export function draftFromNote(draft: ReportDraft, text: string, extract: AiVoiceExtract): ReportDraft {
  return { ...applyExtract(draft, extract), transcript: text.trim(), voice_id: null };
}
