import { aiError, aiFailure } from "@/lib/ai/http";
import { readVoice } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The client stops recording at 30 seconds, so the server caps by format too.
// Compressed audio (opus, AAC, mp3) is under 130 KB for 30 seconds at the usual
// bitrates, so 1 MB leaves a wide margin. Only WAV is raw: 30 seconds of 16-bit
// stereo at 48 kHz is 5.8 MB, so it gets 6 MB.
const MAX_COMPRESSED_BYTES = 1024 * 1024;
const MAX_WAV_BYTES = 6 * 1024 * 1024;
const WAV_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave"]);
// Multipart boundaries and part headers around the file.
const FORM_OVERHEAD_BYTES = 64 * 1024;

const maxBytesFor = (mime: string) => (WAV_TYPES.has(mime.split(";")[0].trim().toLowerCase()) ? MAX_WAV_BYTES : MAX_COMPRESSED_BYTES);

/** A voice note to fields. Multipart with an `audio` file. Returns AiVoiceExtract. */
export async function POST(request: Request) {
  // formData() buffers the whole body, so the size has to be known before it is
  // read. A chunked upload has no Content-Length and is turned away.
  const length = request.headers.get("content-length");
  if (length === null || !/^\d+$/.test(length)) return aiError("bad_request", 411);
  // The format is only known once the body is parsed, so this uses the largest cap.
  if (Number(length) > MAX_WAV_BYTES + FORM_OVERHEAD_BYTES) return aiError("too_large");

  // Content-Length can lie, so the file is checked against its own format's cap below.
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || !audio.type.startsWith("audio/")) return aiError("bad_request");
  if (audio.size > maxBytesFor(audio.type)) return aiError("too_large");

  try {
    const extract = await readVoice({ audio: Buffer.from(await audio.arrayBuffer()), mime: audio.type });
    return Response.json(extract, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return aiFailure(error);
  }
}
