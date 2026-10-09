import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, format, isSameDay } from "date-fns";
import { locale } from "../../config";

// Every timestamp is stored as UTC. Everything a person sees is organisation
// local time with the zone labelled, because someone acting from abroad still
// has to turn up at nine in the morning local time. No raw Date arithmetic
// anywhere else in the codebase: this module is the only place that imports
// date-fns, and eslint enforces that. Relative imports, because the guard
// uses it and the Better Auth CLI loads the guard without the path alias.

export const DEFAULT_TZ: string = locale.defaultTimezone;

const zoneLabels: Record<string, string> = {
  "Asia/Manila": "PHT",
};

export function zoneLabel(tz: string = DEFAULT_TZ): string {
  return zoneLabels[tz] ?? tz;
}

export function inZone(iso: string | Date, tz: string = DEFAULT_TZ): TZDate {
  return new TZDate(typeof iso === "string" ? new Date(iso) : iso, tz);
}

export function now(tz: string = DEFAULT_TZ): TZDate {
  return TZDate.tz(tz);
}

/** The moment this many seconds before `from`. What a stored timestamp is compared against. */
export function secondsBefore(seconds: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - seconds * 1000);
}

/** The moment this many seconds after `from`. */
export function secondsAfter(seconds: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + seconds * 1000);
}

/** The moment this many days before `from`, counted in hours rather than calendar days. */
export function daysBefore(days: number, from: Date = new Date()): Date {
  return secondsBefore(days * 24 * 60 * 60, from);
}

/** Whole seconds from `from` until `to`, rounded up. Negative once `to` has passed. */
export function secondsUntil(to: Date, from: Date = new Date()): number {
  return Math.ceil((to.getTime() - from.getTime()) / 1000);
}

/** "9:30 AM" */
export function formatTime(iso: string | Date, tz?: string): string {
  return format(inZone(iso, tz), "h:mm a");
}

/** "9:30 AM PHT" */
export function formatTimeWithZone(iso: string | Date, tz: string = DEFAULT_TZ): string {
  return `${formatTime(iso, tz)} ${zoneLabel(tz)}`;
}

/** "Fri 5 Sep" */
export function formatShortDate(iso: string | Date, tz?: string): string {
  return format(inZone(iso, tz), "EEE d MMM");
}

/** "Friday 5 September 2026" */
export function formatLongDate(iso: string | Date, tz?: string): string {
  return format(inZone(iso, tz), "EEEE d MMMM yyyy");
}

/** "5 Sep 2026" */
export function formatDate(iso: string | Date, tz?: string): string {
  return format(inZone(iso, tz), "d MMM yyyy");
}

/** "2026-09-05" in local time, the key used to group by day. */
export function dayKey(iso: string | Date, tz?: string): string {
  return format(inZone(iso, tz), "yyyy-MM-dd");
}

/** "Today, Friday 5 September", "Tomorrow, ...", "Yesterday, ..." or the weekday and date. */
export function relativeDayLabel(iso: string | Date, tz: string = DEFAULT_TZ): string {
  const target = inZone(iso, tz);
  const today = now(tz);
  const diff = differenceInCalendarDays(target, today);
  const weekday = format(target, "EEEE d MMMM");
  if (isSameDay(target, today)) return `Today, ${weekday}`;
  if (diff === 1) return `Tomorrow, ${weekday}`;
  if (diff === -1) return `Yesterday, ${weekday}`;
  return weekday;
}
