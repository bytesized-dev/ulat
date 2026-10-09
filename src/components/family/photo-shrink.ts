// The photo a family adds on the check screen: one picture, shrunk on the phone
// before it is kept. The rules live here and the screen only wires them to the
// page. Where the photo is kept is report-photo-store.ts.

/** The long side after shrinking, in pixels. A bigger photo adds seconds to a slow Wi-Fi upload and nothing a responder can use. */
export const PHOTO_MAX_SIDE = 1600;
/** The hub refuses a photo over 10 MB, so the phone never keeps a bigger original. */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const JPEG_QUALITY = 0.85;

/** The types the hub accepts. A photo the browser cannot shrink is kept as it is only when it is one of these. */
const KEEPABLE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const TYPE_BY_EXTENSION: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };

export type PhotoError = "too_big" | "unsupported";

/** What the family reads when a photo cannot be added. */
export const PHOTO_ERRORS: Record<PhotoError, string> = {
  too_big: "That photo is too big. Pick one under 10 MB.",
  unsupported: "We could not read that photo. Pick a JPEG or PNG.",
};

export type PhotoResult = { ok: true; photo: Blob } | { ok: false; error: PhotoError };

/** The size to draw at: the long side is at most `max`, the shape stays, and a small photo is never enlarged. */
export function fitWithin(width: number, height: number, max: number = PHOTO_MAX_SIDE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const scale = max / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The file's image type, read from its extension when the phone left the type empty, as some do for HEIC. Null when the hub would refuse it. */
export function keepableType(file: { type: string; name: string }): string | null {
  const declared = file.type.toLowerCase();
  if (KEEPABLE_TYPES.includes(declared)) return declared;
  if (declared !== "" && declared !== "application/octet-stream") return null;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXTENSION[extension] ?? null;
}

/** Shrinks the file to a JPEG with the long side at most `max`. Rejects when the browser cannot decode it. */
export type Shrink = (file: Blob, max: number) => Promise<Blob>;

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    // "from-image" turns a phone photo upright, so it is not saved on its side.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** The shrink the browser does. Not run in tests, which pass their own. */
export const browserShrink: Shrink = async (file, max) => {
  const picture = await decode(file);
  try {
    const { width, height } = fitWithin(picture.width, picture.height, max);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    // A PNG with see-through parts would turn black in a JPEG.
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
    context.drawImage(picture.source, 0, 0, width, height);
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!jpeg) throw new Error("no jpeg");
    return jpeg;
  } finally {
    picture.release();
  }
};

/**
 * The photo to keep. It is shrunk to a JPEG. If the browser cannot decode it,
 * such as HEIC in Chrome, the original is kept when the hub would take it and it
 * is under 10 MB, and the family gets an error when it is not.
 */
export async function preparePhoto(file: File, shrink: Shrink = browserShrink): Promise<PhotoResult> {
  try {
    return { ok: true, photo: await shrink(file, PHOTO_MAX_SIDE) };
  } catch {
    if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "too_big" };
    const type = keepableType(file);
    if (!type) return { ok: false, error: "unsupported" };
    return { ok: true, photo: file.type === type ? file : new Blob([file], { type }) };
  }
}
