// The family's last recording, kept in memory so the check screen can play it
// back. The hub does not store the audio before the report is sent, so a reload
// loses it and the transcript sheet shows the words without a player.

let note: Blob | null = null;
let url: string | null = null;

/** Keeps the recording the family just made and drops the one before it. */
export function setVoiceAudio(audio: Blob | null): void {
  if (url) URL.revokeObjectURL(url);
  url = null;
  note = audio;
}

/** A playable address for the recording, or null when there is none. */
export function voiceAudioUrl(): string | null {
  if (!note) return null;
  url ??= URL.createObjectURL(note);
  return url;
}
