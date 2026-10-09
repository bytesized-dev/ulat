import type { EntryDetail } from "@/lib/hub/entries";

/** The responder's voice note, kept as audio. Nothing transcribes it. */
export function NoteSection({ entry }: { entry: EntryDetail["entry"] }) {
  return (
    <section aria-labelledby="note-h" className="flex flex-col gap-3">
      <h2 id="note-h" className="text-title-md text-ink">
        {entry.note_path ? "Voice note" : "Note"}
      </h2>
      {entry.note_path ? <audio controls preload="none" src={`/api/files/${entry.id}`} className="w-full" /> : <p className="text-body-md text-body">No note.</p>}
    </section>
  );
}
