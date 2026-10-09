import { NewPhotoMeta, type PhotoStored } from "@/lib/contracts";
import { MAX_PHOTO_BODY_BYTES, MAX_PHOTO_BYTES, MIN_PHOTO_BYTES } from "@/lib/photo-limits";
import { storePhoto } from "../_lib/photo-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A family phone sends the photo here before the report, with no PIN. The
// answer is the photo_id and nothing else: the photo has no address a family
// can fetch. Only a responder or staff can see it, through /api/files by
// photo id, once POST /api/reports has linked it. The hub reads it with the
// photo AI after that, for responders and staff only, and it never changes a
// total.
//
// Anyone on the Wi-Fi can call this, so the disk use is bounded: see
// createUploadStore for the cap on photos no report has taken and the hourly sweep.

const reject = (error: string, status = 400) => Response.json({ error }, { status });

/** One photo: multipart with `photo_id` (a UUID the phone made) and a `photo` file. */
export async function POST(req: Request) {
  // formData() buffers the whole body, so the size has to be known before it is
  // read. A chunked upload has no Content-Length and is turned away.
  const length = req.headers.get("content-length");
  if (length === null || !/^\d+$/.test(length)) return reject("length_required", 411);
  if (Number(length) > MAX_PHOTO_BODY_BYTES) return reject("too_large", 413);

  const form = await req.formData().catch(() => null);
  if (!form) return reject("bad_form");
  const meta = NewPhotoMeta.safeParse({ photo_id: form.get("photo_id") });
  if (!meta.success) return reject("bad_meta");
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return reject("bad_photo");
  if (photo.size < MIN_PHOTO_BYTES) return reject("photo_too_small");
  // Content-Length can lie, so the file is checked against its own cap.
  if (photo.size > MAX_PHOTO_BYTES) return reject("too_large", 413);

  // A resend after a lost reply finds the file it already stored. Nothing is overwritten.
  const stored = await storePhoto(photo, meta.data.photo_id);
  if (!stored.ok) return reject(stored.error, stored.error === "storage_full" ? 507 : 400);
  const { photo_id } = meta.data;
  const body: PhotoStored = { photo_id };
  return Response.json(body, { status: 201, headers: { "Cache-Control": "no-store" } });
}
