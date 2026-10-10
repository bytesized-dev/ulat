import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { z } from "zod";
import type { Db } from "../../db/client";
import { duplicates, entries, photos, reports, responders } from "../../db/schema";
import { reportUrgency } from "../reports/assessment";
import type { AssessmentStatus, CantAssessReason, Confidence, ConfirmedDamageClass, DamageClass, ReportStatus, Urgency } from "../contracts/schemas";

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

export type FamilyReportRow = {
  /** The report id, which /api/files serves the family's recording by. */
  id: string;
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
  /** The family photo, which /api/files serves by this id. Null without a photo. */
  photo_id: string | null;
  photo_path: string | null;
  /** The hub's reading of the photo and any verdict on it. See src/lib/reports/assessment.ts. */
  ai_status: z.infer<typeof AssessmentStatus> | null;
  ai_class: z.infer<typeof DamageClass> | null;
  ai_confidence: z.infer<typeof Confidence> | null;
  ai_reason: string | null;
  ai_hazards: string[] | null;
  ai_at: string | null;
  verdict_class: z.infer<typeof ConfirmedDamageClass> | null;
  verdict_urgency: z.infer<typeof Urgency> | null;
  verdict_note: string | null;
  verdict_by: string | null;
  verdict_at: string | null;
  /** The responder who set the verdict. Null when staff did, or there is none. */
  verdict_name: string | null;
};

// Who set a verdict, joined apart from the assignee.
const verdictResponders = alias(responders, "verdict_responders");

const listed: SQL[] = [inArray(reports.source, ["family", "neighbor"]), ne(reports.status, "merged")];

const rowColumns = {
  id: reports.id,
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
  photo_id: sql<string | null>`(select ${photos.id} from ${photos} where ${photos.report_id} = ${reports.id} and ${photos.path} = ${reports.photo_path})`,
  photo_path: reports.photo_path,
  ai_status: reports.ai_status,
  ai_class: reports.ai_class,
  ai_confidence: reports.ai_confidence,
  ai_reason: reports.ai_reason,
  ai_hazards: reports.ai_hazards,
  ai_at: reports.ai_at,
  verdict_class: reports.verdict_class,
  verdict_urgency: reports.verdict_urgency,
  verdict_note: reports.verdict_note,
  verdict_by: reports.verdict_by,
  verdict_at: reports.verdict_at,
  verdict_name: verdictResponders.name,
};

/** One report from the list, whatever the filter. Undefined for a desk, merged or unknown code. */
export function getFamilyReport(db: Db, code: string): FamilyReportRow | undefined {
  return db
    .select(rowColumns)
    .from(reports)
    .leftJoin(responders, eq(responders.id, reports.assigned_to))
    .leftJoin(verdictResponders, eq(verdictResponders.id, reports.verdict_by))
    .where(and(...listed, eq(reports.code, code)))
    .get();
}

const URGENCY_RANK = { high: 0, medium: 1, low: 2 } as const;

/**
 * High urgency first, then medium, then low, then reports with no reading yet.
 * Inside each group the order is the query's: hurt or missing first, then the
 * newest. Urgency comes from code in reportUrgency, never from the model.
 */
export function sortByUrgency(rows: FamilyReportRow[]): FamilyReportRow[] {
  const rank = (row: FamilyReportRow) => {
    const urgency = reportUrgency(row);
    return urgency === null ? 3 : URGENCY_RANK[urgency];
  };
  // Array.prototype.sort is stable, so ties keep the query's order.
  return [...rows].sort((a, b) => rank(a) - rank(b));
}

/** Highest urgency first, then as the canvas shows: hurt or missing, then the newest. */
export function listFamilyReports(db: Db, filter: FamilyFilter = "all"): FamilyReportRow[] {
  const where = filter === "all" ? and(...listed) : and(...listed, inArray(reports.status, FILTER_STATUSES[filter]));
  const rows = db
    .select(rowColumns)
    .from(reports)
    .leftJoin(responders, eq(responders.id, reports.assigned_to))
    .leftJoin(verdictResponders, eq(verdictResponders.id, reports.verdict_by))
    .where(where)
    .orderBy(desc(sql`(${reports.hurt} > 0 or ${reports.missing} > 0)`), desc(reports.created_at), asc(reports.code))
    .all();
  return sortByUrgency(rows);
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

/** The second look and duplicates tabs. The sidebar badge is their sum. */
export function countReviewQueues(db: Db): Pick<ReviewCounts, "second_look" | "duplicates"> {
  const second = db.select({ n: sql<number>`count(*)` }).from(entries).where(eq(entries.status, "needs_review")).get();
  const dupes = db.select({ n: sql<number>`count(*)` }).from(duplicates).where(eq(duplicates.status, "open")).get();
  return { second_look: second?.n ?? 0, duplicates: dupes?.n ?? 0 };
}

/** The numbers on the Review lists tabs. */
export function countReview(db: Db): ReviewCounts {
  return { ...countReviewQueues(db), family_reports: countFamilyReports(db).all };
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
  // The canvas calls this status "Can't find". Only the hub label changes, the status value stays cant_assess.
  cant_assess: { label: "Can't find", tone: "warning" },
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
