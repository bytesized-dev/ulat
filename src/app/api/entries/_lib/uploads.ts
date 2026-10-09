import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

// Photos and audio live under data/uploads. The extension comes from the mime
// type, never from the client's file name, and stored names are random UUIDs.

export const uploadDir = resolve(process.env.UPLOAD_DIR ?? "data/uploads");

const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};
const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export type Stored = { path: string; mime: string; data: Buffer };

/** Returns an error code, or the stored file. */
export async function storeUpload(file: File, kind: "photo" | "audio"): Promise<Stored | { error: string }> {
  const types = kind === "photo" ? PHOTO_TYPES : AUDIO_TYPES;
  // "audio/webm;codecs=opus" is what MediaRecorder sends.
  const mime = file.type.split(";")[0].trim().toLowerCase();
  const ext = types[mime];
  if (!ext) return { error: `${kind}_type_not_allowed` };
  if (file.size === 0 || file.size > (kind === "photo" ? MAX_PHOTO_BYTES : MAX_AUDIO_BYTES)) {
    return { error: `${kind}_size_not_allowed` };
  }
  const data = Buffer.from(await file.arrayBuffer());
  // SPEC section 1: data/uploads/<yyyy-mm-dd>/<uuid>.<ext>. The database keeps the part after data/uploads.
  const day = new Date().toISOString().slice(0, 10);
  const path = `${day}/${randomUUID()}.${ext}`;
  await mkdir(join(uploadDir, day), { recursive: true });
  await writeFile(join(uploadDir, path), data);
  return { path, mime, data };
}

/** Deletes files stored for a request that did not become an entry. Never throws. */
export async function discardUploads(stored: Pick<Stored, "path">[]): Promise<void> {
  await Promise.all(stored.map((f) => rm(join(uploadDir, f.path), { force: true }).catch(() => undefined)));
}

/** Reads a stored file by the relative path kept in the database. */
export async function readUpload(path: string): Promise<{ data: Buffer; mime: string } | null> {
  const full = resolve(uploadDir, path);
  if (!full.startsWith(uploadDir + sep)) return null;
  const ext = path.split(".").pop() ?? "";
  const mime = Object.entries({ ...PHOTO_TYPES, ...AUDIO_TYPES }).find(([, e]) => e === ext)?.[0];
  if (!mime) return null;
  try {
    return { data: await readFile(full), mime };
  } catch {
    return null;
  }
}
