import { aiError, aiFailure } from "@/lib/ai/http";
import { readVoice } from "@/lib/ai";
import { MAX_VOICE_BODY_BYTES, maxAudioBytes } from "@/lib/audio-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A voice note to fields. Multipart with an `audio` file. Returns AiVoiceExtract. */
export async function POST(request: Request) {
  // formData() buffers the whole body, so the size has to be known before it is
  // read. A chunked upload has no Content-Length and is turned away.
  const length = request.headers.get("content-length");
  if (length === null || !/^\d+$/.test(length)) return aiError("bad_request", 411);
  // The format is only known once the body is parsed, so this uses the largest cap.
  if (Number(length) > MAX_VOICE_BODY_BYTES) return aiError("too_large");

  // Content-Length can lie, so the file is checked against its own format's cap below.
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || !audio.type.startsWith("audio/")) return aiError("bad_request");
  if (audio.size > maxAudioBytes(audio.type)) return aiError("too_large");

  try {
    const extract = await readVoice({ audio: Buffer.from(await audio.arrayBuffer()), mime: audio.type });
    return Response.json(extract, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return aiFailure(error);
  }
}
