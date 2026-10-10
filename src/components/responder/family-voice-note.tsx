type FamilyVoiceNoteProps = {
  transcript: string | null;
  english: string | null;
};

// What the family said at the help desk. Staff record it there and keep the
// words, not the audio. The transcript is in the family's language, the English
// line is the translation. A report a family sends from a phone has none.
function FamilyVoiceNote({ transcript, english }: FamilyVoiceNoteProps) {
  return (
    <section aria-label="The family's note" className="rounded-xl bg-surface-soft p-4">
      {transcript ? <p className="text-body-md text-ink">{transcript}</p> : null}
      {english && english !== transcript ? <p className="mt-3 text-body-sm text-body">{english}</p> : null}
    </section>
  );
}

export { FamilyVoiceNote };
