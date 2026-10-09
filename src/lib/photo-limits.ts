import { FORM_OVERHEAD_BYTES } from "@/lib/audio-limits";

// How big a family report photo may be, and how much of them the hub keeps.
// POST /api/reports/photo takes these. The unlinked caps and the sweep work as
// they do for family voice notes, see audio-limits.ts, with room for photos.

/** The largest a photo may be. A phone camera JPEG is a few MB, and HEIC is smaller. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** The largest a photo upload can be on the wire. */
export const MAX_PHOTO_BODY_BYTES = MAX_PHOTO_BYTES + FORM_OVERHEAD_BYTES;
/** The smallest photo the hub keeps. A real image is far larger, and a smaller file shows nothing. */
export const MIN_PHOTO_BYTES = 1024;

/**
 * How many bytes of family photos no report has taken may sit on the hub.
 * POST /api/reports/photo has no PIN, so this is what stops one phone from
 * filling the laptop that holds the database. Above it the route answers 507.
 */
export const MAX_UNLINKED_PHOTO_BYTES = 200 * 1024 * 1024;
/** The most photos no report has taken that may sit on the hub. It keeps a sweep over them short. */
export const MAX_UNLINKED_PHOTO_FILES = 2000;
/** How many bytes the whole photo folder may hold, linked photos included. Above it the route answers 507. */
export const MAX_PHOTO_FOLDER_BYTES = 4 * 1024 * 1024 * 1024;
/** The disk block size. Every stored file takes at least one, so the caps count each photo as whole blocks. */
export const PHOTO_BLOCK_BYTES = 4096;
/** An unlinked photo older than this is deleted by the next sweep. */
export const UNLINKED_PHOTO_MAX_AGE_MS = 60 * 60 * 1000;
/** The longest the hub goes between two sweeps, which are the only walks of the photo folder. */
export const PHOTO_SWEEP_EVERY_MS = 60 * 1000;
