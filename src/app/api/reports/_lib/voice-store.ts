import { like } from "drizzle-orm";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import {
  MAX_UNLINKED_VOICE_BYTES,
  MAX_UNLINKED_VOICE_FILES,
  MAX_VOICE_FOLDER_BYTES,
  UNLINKED_VOICE_MAX_AGE_MS,
  VOICE_BLOCK_BYTES,
  VOICE_SWEEP_EVERY_MS,
} from "@/lib/audio-limits";
import { createUploadStore, type StoreResult } from "./upload-store";

// Family recordings live apart from photos and responder notes, in
// <uploads>/voice/<yyyy-mm-dd>/<voice_id>.<ext>. See upload-store.ts for how
// the folder is kept. reports.voice_path links a recording.

const store = createUploadStore({
  folder: "voice",
  // The types a family phone can record. The same types the entries route takes.
  types: {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
  },
  typeError: "audio_type_not_allowed",
  limits: () => ({
    unlinkedBytes: MAX_UNLINKED_VOICE_BYTES,
    unlinkedFiles: MAX_UNLINKED_VOICE_FILES,
    folderBytes: MAX_VOICE_FOLDER_BYTES,
    blockBytes: VOICE_BLOCK_BYTES,
    unlinkedMaxAgeMs: UNLINKED_VOICE_MAX_AGE_MS,
    sweepEveryMs: VOICE_SWEEP_EVERY_MS,
  }),
  linkedPaths: () =>
    db.select({ path: reports.voice_path }).from(reports).where(like(reports.voice_path, "voice/%")).all().flatMap((r) => (r.path ? [r.path] : [])),
});

export type StoreVoiceResult = StoreResult<"audio_type_not_allowed">;

/** The relative path of the recording stored under this voice_id, or null. */
export const findVoice = store.find;
/** Stores a recording unless the hub is full, see createUploadStore. */
export const storeVoice = store.store;
/** Tells the counts that a report took this recording, so it stops counting as unlinked. */
export const voiceLinked = store.linked;
