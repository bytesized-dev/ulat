import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, photos } from "@/db/schema";
import { draftPhoto } from "@/lib/ai";
import { audit, emit } from "./audit";
import { readUpload } from "./uploads";

/**
 * Runs the photo pipeline for a saved draft and stores the AI fields on it.
 * This is the draftEntry(entryId) of BYT-14. It belongs in src/lib/ai next to
 * draftPhoto; it lives here until Platform moves it. Behind MOCK_AI=1 it
 * returns the fixture, and the real call lands with BYT-25.
 */
export async function draftEntry(entryId: string): Promise<void> {
  const entry = db.select().from(entries).where(eq(entries.id, entryId)).get();
  if (!entry) return;
  const rows = db.select().from(photos).where(eq(photos.entry_id, entryId)).all();
  const files = [];
  for (const row of rows) {
    const file = await readUpload(row.path);
    if (file) files.push({ data: file.data, mime: file.mime, label: row.label ?? "" });
  }

  let draft;
  try {
    draft = await draftPhoto({ photos: files, note: entry.note_transcript });
  } catch (error) {
    // A failed or invalid AI call is not an error for the responder: the draft
    // stays without an AI class and the raw failure goes to the audit trail.
    audit(db, entryId, "entry.ai_failed", "system", { error: String(error) });
    return;
  }

  db.update(entries)
    .set({
      ai_class: draft.damage_class,
      ai_confidence: draft.confidence,
      ai_reason: draft.reason,
      ai_need_more: draft.need_more,
      material: draft.material,
      hazards: draft.hazards,
    })
    .where(eq(entries.id, entryId))
    .run();
  audit(db, entryId, "entry.ai_drafted", "system", { raw: draft });
  emit({ type: "entry.drafted", entry_id: entryId });
}
