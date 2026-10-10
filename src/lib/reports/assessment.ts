import type { z } from "zod";
import type { AssessmentStatus, ConfirmedDamageClass, DamageClass, Urgency } from "@/lib/contracts";

// The hub reads a family report's photo, and code turns that reading plus the
// report's hurt and missing into an urgency. The model never picks the
// urgency: it only says what it sees in one photo. A responder's or staff
// member's verdict replaces both class and urgency. None of this changes a
// total, which comes only from confirmed entries. Screens compute urgency when
// they read a report, because merging a duplicate can raise hurt and missing.

type AiClass = z.infer<typeof DamageClass>;
type VerdictClass = z.infer<typeof ConfirmedDamageClass>;
type UrgencyValue = z.infer<typeof Urgency>;
type Status = z.infer<typeof AssessmentStatus>;

export type AssessmentFields = {
  hurt: number;
  missing: number;
  ai_class: AiClass | null;
  ai_hazards: string[] | null;
  verdict_class: VerdictClass | null;
  verdict_urgency: UrgencyValue | null;
};

/** A reading still pending after this long is stalled, and Run again is offered. */
export const STALL_MS = 5 * 60_000;

export const URGENCY_LABELS: Record<UrgencyValue, string> = { high: "High urgency", medium: "Medium urgency", low: "Low urgency" };

/** StatusDot tones. Low has no dot, so only its words carry it. */
export const URGENCY_TONE: Record<UrgencyValue, "danger" | "warning" | null> = { high: "danger", medium: "warning", low: null };

export const ASSESSMENT_CLASS_LABELS: Record<AiClass, string> = {
  none: "No damage",
  partial: "Partially damaged",
  total: "Totally damaged",
  unclear: "Not sure",
};

export const ASSESSMENT_CLASS_TONE: Record<AiClass, "success" | "warning" | "danger" | "muted-soft"> = {
  none: "success",
  partial: "warning",
  total: "danger",
  unclear: "muted-soft",
};

/**
 * Urgency from the AI reading and the report's own counts. Null without a
 * reading. Hazards are free text from a small model, so on their own they lift
 * a house to medium, never to high.
 */
export function computedUrgency(report: Omit<AssessmentFields, "verdict_class" | "verdict_urgency">): UrgencyValue | null {
  if (report.ai_class === null) return null;
  if (report.hurt + report.missing > 0 || report.ai_class === "total") return "high";
  if (report.ai_class === "partial" || report.ai_class === "unclear" || (report.ai_hazards?.length ?? 0) > 0) return "medium";
  return "low";
}

/** The urgency every screen shows: the verdict when there is one, else the computed one. */
export function reportUrgency(report: AssessmentFields): UrgencyValue | null {
  return report.verdict_urgency ?? computedUrgency(report);
}

/** The class every screen shows: the verdict when there is one, else the AI's. */
export function reportClass(report: Pick<AssessmentFields, "ai_class" | "verdict_class">): AiClass | null {
  return report.verdict_class ?? report.ai_class;
}

/** Why the computed urgency is what it is, in one sentence. */
export function urgencyReason(report: Omit<AssessmentFields, "verdict_class" | "verdict_urgency">): string | null {
  const urgency = computedUrgency(report);
  if (urgency === null) return null;
  if (report.hurt + report.missing > 0) return "Someone in the house is hurt or missing.";
  if (report.ai_class === "total") return "The photo shows a totally damaged house.";
  if (report.ai_class === "partial") return "The photo shows a partially damaged house.";
  if (report.ai_class === "unclear") return "The photo does not show enough to judge the damage.";
  if ((report.ai_hazards?.length ?? 0) > 0) return "The photo shows a hazard.";
  return "No damage in the photo and nobody hurt or missing.";
}

/** True while the hub is still reading the photo and has not taken too long. */
export function isReading(status: Status | null, at: string | null, now: number = Date.now()): boolean {
  return status === "pending" && !isStalled(status, at, now);
}

/** A pending reading that has taken longer than STALL_MS, for example because the hub restarted mid-read. */
export function isStalled(status: Status | null, at: string | null, now: number = Date.now()): boolean {
  if (status !== "pending") return false;
  const started = at === null ? Number.NaN : Date.parse(at);
  return Number.isNaN(started) || now - started > STALL_MS;
}

type ReportRow = AssessmentFields & {
  code: string;
  photo_path: string | null;
  ai_status: Status | null;
  ai_confidence: "low" | "medium" | "high" | null;
  ai_reason: string | null;
  ai_at: string | null;
  verdict_note: string | null;
  verdict_by: string | null;
  verdict_at: string | null;
};

/** Everything a screen needs to show a report's photo assessment. Null when the report has no photo. */
export type AssessmentView = {
  code: string;
  /** The hub is still reading the photo. */
  reading: boolean;
  /** The photo came before the hub read family photos, so it was never read. */
  unread: boolean;
  /** The last reading failed or stalled, or there never was one, so Run again is offered. */
  canRunAgain: boolean;
  ai: { damage_class: AiClass; confidence: "low" | "medium" | "high" | null; reason: string | null; hazards: string[] } | null;
  verdict: { damage_class: VerdictClass; urgency: UrgencyValue; note: string | null; by: string; at: string } | null;
  /** The class and urgency every screen shows: the verdict's, else the AI's and the computed one. */
  damage_class: AiClass | null;
  urgency: UrgencyValue | null;
  /** Why the urgency is what it is. */
  why: string | null;
};

/**
 * The assessment as screens show it. byName turns a verdict_by id into a
 * person's name, "staff" into "Hub staff".
 */
export function assessmentView(report: ReportRow, byName: (id: string) => string, now: number = Date.now()): AssessmentView | null {
  if (report.photo_path === null) return null;
  const reading = isReading(report.ai_status, report.ai_at, now);
  const ai =
    !reading && report.ai_class !== null
      ? { damage_class: report.ai_class, confidence: report.ai_confidence, reason: report.ai_reason, hazards: report.ai_hazards ?? [] }
      : null;
  const verdict =
    report.verdict_class !== null && report.verdict_urgency !== null
      ? {
          damage_class: report.verdict_class,
          urgency: report.verdict_urgency,
          note: report.verdict_note,
          by: byName(report.verdict_by ?? "staff"),
          at: report.verdict_at ?? "",
        }
      : null;
  const fields = { ...report, ai_class: ai ? report.ai_class : null };
  return {
    code: report.code,
    reading,
    unread: report.ai_status === null,
    canRunAgain: report.ai_status === null || report.ai_status === "failed" || isStalled(report.ai_status, report.ai_at, now),
    ai,
    verdict,
    damage_class: verdict?.damage_class ?? ai?.damage_class ?? null,
    urgency: verdict?.urgency ?? computedUrgency(fields),
    why: verdict ? `Set by ${verdict.by}.` : urgencyReason(fields),
  };
}
