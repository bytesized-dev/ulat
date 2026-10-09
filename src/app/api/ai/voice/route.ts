import { aiError, aiFailure } from "@/lib/ai/http";
import { readVoice } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Thirty seconds of opus or AAC is about 150 KB. A thirty second 16-bit WAV at
// 48 kHz stereo is 5.8 MB. 8 MB covers both, and the client stops at 30 seconds.
const MAX_BYTES = 8 * 1024 * 1024;

/** A voice note to fields. Multipart with an `audio` file. Returns AiVoiceExtract. */
export async function POST(request: Request) {
  // Turn away an oversized upload before reading it. Content-Length can lie,
  // so the file size is checked again below.
  if (Number(request.headers.get("content-length")) > MAX_BYTES + 64 * 1024) return aiError("too_large");

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || !audio.type.startsWith("audio/")) return aiError("bad_request");
  if (audio.size > MAX_BYTES) return aiError("too_large");

  try {
    const extract = await readVoice({ audio: Buffer.from(await audio.arrayBuffer()), mime: audio.type });
    return Response.json(extract, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return aiFailure(error);
  }
}
