import type { EntryDetail } from "@/lib/hub/entries";

/** The responder's voice note: a player, what was said, and the English reading of it. */
export function NoteSection({ entry }: { entry: EntryDetail["entry"] }) {
  const hasNote = entry.note_path || entry.note_transcript;
  return (
    <section aria-labelledby="note-h" className="flex flex-col gap-3">
      <h2 id="note-h" className="text-title-md text-ink">
        {entry.note_path ? "Voice note" : "Note"}
      </h2>
      {entry.note_path ? <audio controls preload="none" src={`/api/files/${entry.id}`} className="w-full" /> : null}
      {entry.note_transcript ? <p className="text-body-md text-ink">{entry.note_transcript}</p> : null}
      {entry.note_en && entry.note_en !== entry.note_transcript ? <p className="text-body-md text-body">{entry.note_en}</p> : null}
      {hasNote ? null : <p className="text-body-md text-body">No note.</p>}
    </section>
  );
}
