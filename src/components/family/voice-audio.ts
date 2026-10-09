// The family's last recording, kept in memory so the check screen can play it
// back and the send screen can upload it. The hub does not hold the audio until
// the family sends, so a reload loses it. The transcript sheet then shows the
// words without a player, and the report goes without audio.

let note: Blob | null = null;
let url: string | null = null;

/** Keeps the recording the family just made and drops the one before it. */
export function setVoiceAudio(audio: Blob | null): void {
  if (url) URL.revokeObjectURL(url);
  url = null;
  note = audio;
}

/** The recording itself, for the send screen. Null when there is none. */
export function voiceAudioBlob(): Blob | null {
  return note;
}

/** A file name for the queue, from the recording's type. The hub never reads it. */
export function voiceFileName(audio: Blob): string {
  const kind = audio.type.split(";")[0].split("/")[1]?.replace(/[^a-z0-9]/gi, "");
  return `note.${kind || "webm"}`;
}

/** A playable address for the recording, or null when there is none. */
export function voiceAudioUrl(): string | null {
  if (!note) return null;
  url ??= URL.createObjectURL(note);
  return url;
}
