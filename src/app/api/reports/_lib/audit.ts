import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "@/db/client";
import { events, reports } from "@/db/schema";
import type { HubEvent, ReportStatus } from "@/lib/contracts";
import { publish } from "@/lib/live/bus";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The audit type for every status change. The family timeline reads these rows. */
export const STATUS_CHANGED = "report.status_changed";

/** One audit row. Every write to a report adds at least one. */
export function audit(tx: Tx | Db, reportId: string, type: string, actor: string, data: Record<string, unknown> = {}) {
  tx.insert(events).values({ entity: "report", entity_id: reportId, type, actor, data, at: new Date().toISOString() }).run();
}

/**
 * Moves a report to a new status and writes the audit row in the same
 * transaction. The assign and can't assess routes use this, so the timeline
 * always finds the time of each step. Returns the event to publish after commit.
 */
export function setStatus(
  tx: Tx | Db,
  report: { id: string; code: string },
  status: z.infer<typeof ReportStatus>,
  actor: string,
  fields: Partial<typeof reports.$inferInsert> = {},
  data: Record<string, unknown> = {},
): HubEvent {
  const now = new Date().toISOString();
  tx.update(reports).set({ ...fields, status, updated_at: now }).where(eq(reports.id, report.id)).run();
  tx.insert(events)
    .values({ entity: "report", entity_id: report.id, type: STATUS_CHANGED, actor, data: { ...data, status }, at: now })
    .run();
  return { type: "report.updated", code: report.code, status };
}

/**
 * Tells every open /api/events stream. Handlers call this after their
 * transaction commits. A failed publish must not turn a saved write into an
 * error, so it is caught here.
 */
export function emit(event: HubEvent) {
  try {
    publish(event);
  } catch (error) {
    console.error("live publish failed", error);
  }
}
