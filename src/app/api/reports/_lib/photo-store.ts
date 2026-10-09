import { like } from "drizzle-orm";
import { db } from "@/db/client";
import { photos } from "@/db/schema";
import {
  MAX_PHOTO_FOLDER_BYTES,
  MAX_UNLINKED_PHOTO_BYTES,
  MAX_UNLINKED_PHOTO_FILES,
  PHOTO_BLOCK_BYTES,
  PHOTO_SWEEP_EVERY_MS,
  UNLINKED_PHOTO_MAX_AGE_MS,
} from "@/lib/photo-limits";
import { createUploadStore, type StoreResult } from "./upload-store";

// Family photos live apart from recordings and responder photos, in
// <uploads>/photo/<yyyy-mm-dd>/<photo_id>.<ext>. See upload-store.ts for how
// the folder is kept. A photo is linked when a photos row has its path.

const store = createUploadStore({
  folder: "photo",
  // The same types, with the same extensions, as PHOTO_TYPES in the entries
  // uploads, so /api/files serves each with the right mime.
  types: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  },
  typeError: "photo_type_not_allowed",
  limits: () => ({
    unlinkedBytes: MAX_UNLINKED_PHOTO_BYTES,
    unlinkedFiles: MAX_UNLINKED_PHOTO_FILES,
    folderBytes: MAX_PHOTO_FOLDER_BYTES,
    blockBytes: PHOTO_BLOCK_BYTES,
    unlinkedMaxAgeMs: UNLINKED_PHOTO_MAX_AGE_MS,
    sweepEveryMs: PHOTO_SWEEP_EVERY_MS,
  }),
  linkedPaths: () => db.select({ path: photos.path }).from(photos).where(like(photos.path, "photo/%")).all().map((r) => r.path),
});

export type StorePhotoResult = StoreResult<"photo_type_not_allowed">;

/** The relative path of the photo stored under this photo_id, or null. */
export const findPhoto = store.find;
/** Stores a photo unless the hub is full, see createUploadStore. */
export const storePhoto = store.store;
/** Tells the counts that a report took this photo, so it stops counting as unlinked. */
export const photoLinked = store.linked;
