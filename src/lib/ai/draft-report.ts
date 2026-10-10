import { asc, eq } from "drizzle-orm";
import { readUpload } from "@/app/api/entries/_lib/uploads";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { publish } from "@/lib/live/bus";
import { logReportAiCall } from "./audit";
import { draftPhotoWithRaw } from "./index";
import { OllamaError } from "./ollama";

// What a reading says when the model could not decide. Screens show "Not sure"
// with Run again, never an empty block.
const FALLBACK_REASON = "The AI could not read this photo.";

/**
 * Reads a family report's photo and stores what the model sees on the report:
 * class, confidence, hazards and a one-line reason. The photo goes alone,
 * without the family's note, so the reading does not just repeat their words.
 * If the call fails, returns invalid output or runs past 60 seconds, the report
 * gets unclear with low confidence and status failed, the failure goes to the
 * audit trail, and report.assessed still goes out so screens stop waiting.
 */
export async function draftReport(reportId: string): Promise<void> {
  const report = db.select({ code: reports.code, photo_path: reports.photo_path }).from(reports).where(eq(reports.id, reportId)).get();
  if (!report || report.photo_path === null) return;

  let fields: Partial<typeof reports.$inferInsert>;
  try {
    const file = await readUpload(report.photo_path);
    if (!file) throw new Error("The family photo could not be read from the uploads folder");
    const { draft, raw } = await draftPhotoWithRaw({ photos: [{ data: file.data, mime: file.mime, label: "Family photo" }] });
    await logReportAiCall(reportId, "photo", { raw });
    fields = {
      ai_status: "done",
      ai_class: draft.damage_class,
      ai_confidence: draft.confidence,
      ai_reason: draft.reason,
      ai_hazards: draft.hazards,
    };
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    await logReportAiCall(reportId, "photo", { raw: error instanceof OllamaError ? error.raw : null, error: failure });
    fields = { ai_status: "failed", ai_class: "unclear", ai_confidence: "low", ai_reason: FALLBACK_REASON, ai_hazards: [] };
  }

  db.update(reports)
    .set({ ...fields, ai_at: new Date().toISOString() })
    .where(eq(reports.id, reportId))
    .run();
  try {
    publish({ type: "report.assessed", code: report.code });
  } catch (error) {
    console.error("Could not publish report.assessed", error);
  }
}

// One family photo at a time. A burst of family reports would otherwise wait
// inside Ollama and push a responder's photo draft, which calls the model
// directly, past its 60 second timeout. The queue lives on globalThis, like the
// live bus, because Next bundles each route on its own.
type DraftQueue = { tail: Promise<void>; queued: Set<string> };
const globalForDrafts = globalThis as unknown as { ulatReportDrafts?: DraftQueue };
const queue: DraftQueue = (globalForDrafts.ulatReportDrafts ??= { tail: Promise.resolve(), queued: new Set() });

/**
 * Queues the reading of a report's photo and returns when it has run. A report
 * already in the queue is not added twice.
 */
export function queueReportDraft(reportId: string): Promise<void> {
  if (queue.queued.has(reportId)) return queue.tail;
  queue.queued.add(reportId);
  const run = queue.tail
    .then(() => draftReport(reportId))
    .catch((error) => console.error("Family photo reading failed", error))
    .finally(() => queue.queued.delete(reportId));
  queue.tail = run;
  return run;
}

/** Queues every reading left pending, for example by a hub restart. Returns how many. */
export function resumePendingReportDrafts(): number {
  const pending = db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.ai_status, "pending"))
    .orderBy(asc(reports.created_at))
    .all();
  for (const report of pending) void queueReportDraft(report.id);
  return pending.length;
}
