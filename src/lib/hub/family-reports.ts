import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "../../db/client";
import { duplicates, entries, reports, responders } from "../../db/schema";
import type { CantAssessReason, ReportStatus } from "../contracts/schemas";

// The hub's family reports list, docs/SPEC.md sections 4 and 6. Family and
// neighbor reports only: help desk intake has its own screen. Every count is
// one SQL query. Callers pass the database so tests can use their own file.

export const FAMILY_FILTERS = ["all", "not_assigned", "on_the_way", "problems"] as const;
export type FamilyFilter = (typeof FAMILY_FILTERS)[number];

export const FILTER_LABELS: Record<FamilyFilter, string> = {
  all: "All",
  not_assigned: "Not assigned",
  on_the_way: "On the way",
  problems: "Problems",
};

type Status = z.infer<typeof ReportStatus>;

/** The statuses behind each filter. All is every status but merged. */
const FILTER_STATUSES: Record<Exclude<FamilyFilter, "all">, Status[]> = {
  not_assigned: ["waiting"],
  on_the_way: ["assigned", "on_the_way"],
  problems: ["cant_assess"],
};

/** Reports a responder can still be sent to. Visited and merged reports are done. */
export const ASSIGNABLE: readonly Status[] = ["waiting", "assigned", "on_the_way", "cant_assess"];

export type FamilyReportRow = {
  code: string;
  household_head: string;
  barangay: string;
  purok: string | null;
  hurt: number;
  missing: number;
  status: Status;
  cant_reason: z.infer<typeof CantAssessReason> | null;
  assigned_to: string | null;
  assigned_name: string | null;
  transcript: string | null;
  what_happened: string | null;
  created_at: string;
};

const listed: SQL[] = [inArray(reports.source, ["family", "neighbor"]), ne(reports.status, "merged")];

/** Urgent first, then the newest, as the canvas shows. */
export function listFamilyReports(db: Db, filter: FamilyFilter = "all"): FamilyReportRow[] {
  const where = filter === "all" ? and(...listed) : and(...listed, inArray(reports.status, FILTER_STATUSES[filter]));
  return db
    .select({
      code: reports.code,
      household_head: reports.household_head,
      barangay: reports.barangay,
      purok: reports.purok,
      hurt: reports.hurt,
      missing: reports.missing,
      status: reports.status,
      cant_reason: reports.cant_reason,
      assigned_to: reports.assigned_to,
      assigned_name: responders.name,
      transcript: reports.transcript,
      what_happened: reports.what_happened,
      created_at: reports.created_at,
    })
    .from(reports)
    .leftJoin(responders, eq(responders.id, reports.assigned_to))
    .where(where)
    .orderBy(desc(sql`(${reports.hurt} > 0 or ${reports.missing} > 0)`), desc(reports.created_at), asc(reports.code))
    .all();
}

export type FamilyCounts = Record<FamilyFilter, number>;

/** The number on each filter, in one query. */
export function countFamilyReports(db: Db): FamilyCounts {
  const row = db
    .select({
      all: sql<number>`count(*)`,
      not_assigned: sql<number>`coalesce(sum(${reports.status} = 'waiting'), 0)`,
      on_the_way: sql<number>`coalesce(sum(${reports.status} in ('assigned', 'on_the_way')), 0)`,
      problems: sql<number>`coalesce(sum(${reports.status} = 'cant_assess'), 0)`,
    })
    .from(reports)
    .where(and(...listed))
    .get();
  return row ?? { all: 0, not_assigned: 0, on_the_way: 0, problems: 0 };
}

export type ReviewCounts = { second_look: number; duplicates: number; family_reports: number };

/** The numbers on the Review lists tabs. */
export function countReview(db: Db): ReviewCounts {
  const second = db.select({ n: sql<number>`count(*)` }).from(entries).where(eq(entries.status, "needs_review")).get();
  const dupes = db.select({ n: sql<number>`count(*)` }).from(duplicates).where(eq(duplicates.status, "open")).get();
  return { second_look: second?.n ?? 0, duplicates: dupes?.n ?? 0, family_reports: countFamilyReports(db).all };
}

/** Active responders for the Assign to list. */
export function listResponders(db: Db): { id: string; name: string }[] {
  return db
    .select({ id: responders.id, name: responders.name })
    .from(responders)
    .where(eq(responders.active, true))
    .orderBy(asc(responders.name))
    .all();
}

/* ---------- Labels, pure ---------- */

export type StatusTone = "danger" | "warning" | "success" | "primary" | "muted-soft";

const CANT_LABELS: Record<z.infer<typeof CantAssessReason>, string> = {
  cant_find: "Can't find",
  no_one_home: "No one home",
  road_blocked: "Road blocked",
  not_safe: "Not safe",
  other: "Can't assess",
};

const STATUS_LABELS: Record<Status, { label: string; tone: StatusTone }> = {
  waiting: { label: "Waiting", tone: "muted-soft" },
  assigned: { label: "Assigned", tone: "primary" },
  on_the_way: { label: "On the way", tone: "primary" },
  visited: { label: "Visited", tone: "success" },
  cant_assess: { label: "Can't assess", tone: "warning" },
  merged: { label: "Merged", tone: "muted-soft" },
};

/** The status pill. A can't assess report says why. */
export function statusLabel(row: Pick<FamilyReportRow, "status" | "cant_reason">): { label: string; tone: StatusTone } {
  if (row.status === "cant_assess" && row.cant_reason) return { label: CANT_LABELS[row.cant_reason], tone: "warning" };
  return STATUS_LABELS[row.status];
}

/** "2 hurt", "1 missing", both, or null when nobody is hurt or missing. */
export function urgentLabel(row: Pick<FamilyReportRow, "hurt" | "missing">): string | null {
  const parts: string[] = [];
  if (row.hurt > 0) parts.push(`${row.hurt} hurt`);
  if (row.missing > 0) parts.push(`${row.missing} missing`);
  return parts.length ? parts.join(", ") : null;
}

/** Reads ?show= into a filter. Anything else is All. */
export function parseFilter(raw: string | string[] | undefined): FamilyFilter {
  return typeof raw === "string" && (FAMILY_FILTERS as readonly string[]).includes(raw) ? (raw as FamilyFilter) : "all";
}
