import { MAX_VOICE_BODY_BYTES, maxAudioBytes } from "@/lib/audio-limits";
import { NewVoiceMeta, type VoiceStored } from "@/lib/contracts";
import { findUpload, storeUpload } from "../../entries/_lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A family phone sends the recording here before the report, with no PIN. The
// answer is the voice_id and nothing else: the audio has no address a family
// can fetch. Only a responder or staff can play it, through /api/files by
// report id, once POST /api/reports has linked it.

const reject = (error: string, status = 400) => Response.json({ error }, { status });

/** One recording: multipart with `voice_id` (a UUID the phone made) and an `audio` file. */
export async function POST(req: Request) {
  // formData() buffers the whole body, so the size has to be known before it is
  // read. A chunked upload has no Content-Length and is turned away.
  const length = req.headers.get("content-length");
  if (length === null || !/^\d+$/.test(length)) return reject("length_required", 411);
  if (Number(length) > MAX_VOICE_BODY_BYTES) return reject("too_large", 413);

  const form = await req.formData().catch(() => null);
  if (!form) return reject("bad_form");
  const meta = NewVoiceMeta.safeParse({ voice_id: form.get("voice_id") });
  if (!meta.success) return reject("bad_meta");
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return reject("bad_audio");
  // Content-Length can lie, so the file is checked against its own format's cap.
  if (audio.size > maxAudioBytes(audio.type)) return reject("too_large", 413);

  const { voice_id } = meta.data;
  // A resend after a lost reply finds the file it already stored. Nothing is overwritten.
  if (!(await findUpload(voice_id))) {
    const stored = await storeUpload(audio, "audio", { id: voice_id, maxBytes: maxAudioBytes(audio.type) });
    if ("error" in stored) return reject(stored.error);
  }
  const body: VoiceStored = { voice_id };
  return Response.json(body, { status: 201, headers: { "Cache-Control": "no-store" } });
}
