// How big a family or responder voice note may be. POST /api/ai/voice and
// POST /api/reports/voice both take it, so the two routes cannot drift apart.
//
// The client stops recording at 30 seconds, so the server caps by format too.
// Compressed audio (opus, AAC, mp3) is under 130 KB for 30 seconds at the usual
// bitrates, so 1 MB leaves a wide margin. Only WAV is raw: 30 seconds of 16-bit
// stereo at 48 kHz is 5.8 MB, so it gets 6 MB.

export const MAX_COMPRESSED_BYTES = 1024 * 1024;
export const MAX_WAV_BYTES = 6 * 1024 * 1024;
/** Multipart boundaries and part headers around the file. */
export const FORM_OVERHEAD_BYTES = 64 * 1024;
/** The largest a voice note upload can be on the wire, whatever its format. */
export const MAX_VOICE_BODY_BYTES = MAX_WAV_BYTES + FORM_OVERHEAD_BYTES;

const WAV_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave"]);

/** The most bytes a voice note of this mime type may have. Parameters such as codecs are ignored. */
export const maxAudioBytes = (mime: string) => (WAV_TYPES.has(mime.split(";")[0].trim().toLowerCase()) ? MAX_WAV_BYTES : MAX_COMPRESSED_BYTES);

/**
 * How many bytes of family recordings no report has taken may sit on the hub.
 * POST /api/reports/voice has no PIN, so this is what stops one phone from
 * filling the laptop that holds the database. Above it the route answers 507.
 */
export const MAX_UNLINKED_VOICE_BYTES = 200 * 1024 * 1024;
/** An unlinked recording older than this is deleted on the next upload. */
export const UNLINKED_VOICE_MAX_AGE_MS = 60 * 60 * 1000;
