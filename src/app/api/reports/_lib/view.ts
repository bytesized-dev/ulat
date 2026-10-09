import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { entries, events, reports, responders } from "@/db/schema";
import { ReportStatusView } from "@/lib/contracts";
import { STATUS_CHANGED } from "./audit";

type Report = typeof reports.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Someone hurt or missing puts a report at the top of every list. */
export function isUrgent(report: Pick<Report, "hurt" | "missing">): boolean {
  return report.hurt > 0 || report.missing > 0;
}

/** The same rule in SQL, for ordering. */
export const urgentSql = sql<number>`(${reports.hurt} > 0 or ${reports.missing} > 0)`;

/** When the report first moved to this status, from the audit trail. */
function statusTime(db: Db, reportId: string, status: Report["status"]): string | null {
  const row = db
    .select({ at: events.at })
    .from(events)
    .where(
      and(
        eq(events.entity, "report"),
        eq(events.entity_id, reportId),
        eq(events.type, STATUS_CHANGED),
        sql`json_extract(${events.data}, '$.status') = ${status}`,
      ),
    )
    .orderBy(asc(events.at))
    .get();
  return row?.at ?? null;
}

/**
 * What a family sees for their own code: the household label, the timeline and
 * the confirmed result. No injuries, no location, no reporter.
 */
export function statusView(db: Db, report: Report): ReportStatusView {
  const linked = db.select().from(entries).where(eq(entries.report_id, report.id)).orderBy(asc(entries.created_at)).all();
  const first = linked[0];
  const confirmed = linked.find((e) => e.status === "confirmed");

  const onTheWay = statusTime(db, report.id, "on_the_way") ?? (report.status === "on_the_way" ? report.updated_at : null);
  // The responder made the entry at the house, so its time is the visit.
  const visited = first?.created_at ?? (report.status === "visited" ? report.updated_at : null);

  // confirmed_by holds a responder id or "staff" from the entries API, and a
  // name from the seed. Families see a name, never an id.
  const by = confirmed?.confirmed_by ?? null;
  const responder = by ? db.select({ name: responders.name }).from(responders).where(eq(responders.id, by)).get() : undefined;
  const confirmedBy = responder?.name ?? (by && by !== "staff" && !UUID.test(by) ? by : null);

  return ReportStatusView.parse({
    code: report.code,
    household_head: report.household_head,
    barangay: report.barangay,
    purok: report.purok,
    urgent: isUrgent(report),
    steps: [
      { step: "received", at: report.created_at },
      { step: "on_the_way", at: onTheWay },
      { step: "visited", at: visited },
      { step: "confirmed", at: confirmed?.confirmed_at ?? null },
    ],
    result: confirmed?.damage_class ?? null,
    confirmed_by: confirmedBy,
  });
}
