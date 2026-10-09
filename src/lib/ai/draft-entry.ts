import { and, eq } from "drizzle-orm";
import { readUpload } from "@/app/api/entries/_lib/uploads";
import { db } from "@/db/client";
import { entries, photos } from "@/db/schema";
import { publish } from "@/lib/live/bus";
import { logEntryAiCall } from "./audit";
import { draftPhotoWithRaw } from "./index";
import { OllamaError } from "./ollama";

// What a draft says when the model could not decide. The responder sees
// "unclear" with a request for a better photo, never an empty draft.
const FALLBACK_NEED_MORE = "Clear photo of the whole house";
const FALLBACK_REASON = "The AI could not decide from these photos.";

/**
 * Runs the photo pipeline for a saved draft entry and stores the AI fields on
 * it: one house per call, the raw model reply in the audit trail. If the call
 * fails, returns invalid output or runs past 60 seconds, the entry gets
 * `unclear` with low confidence, the failure goes to the audit trail, and
 * `entry.drafted` still goes out so the drafting screen moves on.
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

  let fields: Partial<typeof entries.$inferInsert>;
  // What the responder may have changed while the model ran. Only written
  // while the entry is still a draft.
  let editable: Partial<typeof entries.$inferInsert> = {};
  try {
    if (files.length === 0) throw new Error("No readable photos for this entry");
    const { draft, raw } = await draftPhotoWithRaw({ photos: files, note: entry.note_transcript });
    await logEntryAiCall(entryId, "photo", { raw });
    fields = {
      ai_class: draft.damage_class,
      ai_confidence: draft.confidence,
      ai_reason: draft.reason,
      // An unclear class always says which photo is missing.
      ai_need_more: draft.need_more ?? (draft.damage_class === "unclear" ? FALLBACK_NEED_MORE : null),
    };
    editable = { material: draft.material, hazards: draft.hazards };
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    await logEntryAiCall(entryId, "photo", {
      raw: error instanceof OllamaError ? error.raw : null,
      error: failure,
    });
    fields = {
      ai_class: "unclear",
      ai_confidence: "low",
      ai_reason: FALLBACK_REASON,
      ai_need_more: FALLBACK_NEED_MORE,
    };
  }

  // The AI fields are the draft's own record, so they are always stored. The
  // responder can confirm while the model runs, and then material and hazards
  // are theirs: a late draft must not overwrite them.
  db.update(entries).set(fields).where(eq(entries.id, entryId)).run();
  if (Object.keys(editable).length > 0) {
    db.update(entries)
      .set(editable)
      .where(and(eq(entries.id, entryId), eq(entries.status, "draft")))
      .run();
  }
  publish({ type: "entry.drafted", entry_id: entryId });
}
