import { HubEvent, ReportCode, ReportStatusView } from "@/lib/contracts";
import type { StatusDotTone } from "@/components/ui/status-dot";
import type { TimelineItem } from "@/components/ui/timeline";
import { formatTime } from "@/lib/time";

// Pure parts of the status screen: the code a family typed, the request to the
// hub, and how a ReportStatusView becomes the timeline and the result. The
// screen only wires them to the page.

/** A code as the API wants it: the family may type it in lower case or with spaces. */
export function normalizeCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export type StatusResult = { ok: true; view: ReportStatusView } | { ok: false; message: string };

const MESSAGES = {
  bad_code: "That code does not look right. It has 4 letters and numbers.",
  not_found: "We could not find that code. Check it and try again.",
  unreachable: "Could not reach the hub. Check the Wi-Fi and try again.",
};

/** Looks the code up on the hub and checks what comes back. Never throws. */
export async function fetchStatus(code: string, send: typeof fetch = fetch, signal?: AbortSignal): Promise<StatusResult> {
  const normalized = normalizeCode(code);
  if (!ReportCode.safeParse(normalized).success) return { ok: false, message: MESSAGES.bad_code };
  try {
    const res = await send(`/api/reports/${normalized}`, { signal });
    if (res.status === 404) return { ok: false, message: MESSAGES.not_found };
    if (res.status === 400) return { ok: false, message: MESSAGES.bad_code };
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: MESSAGES.unreachable };
    const view = ReportStatusView.safeParse(body);
    return view.success ? { ok: true, view: view.data } : { ok: false, message: MESSAGES.unreachable };
  } catch {
    return { ok: false, message: MESSAGES.unreachable };
  }
}

function timeOf(view: ReportStatusView, step: ReportStatusView["steps"][number]["step"]): string | null {
  return view.steps.find((s) => s.step === step)?.at ?? null;
}

/**
 * The four rows a family reads. A row with a time is done, the first one
 * without is the current step and the rest are upcoming. Before the visit the
 * second row says "Waiting for a visit", and once the responder is on the way
 * it says "On the way". The last row says "Result" until it is confirmed.
 */
export function timelineItems(view: ReportStatusView): TimelineItem[] {
  const rows = [
    { label: "Received", at: timeOf(view, "received") },
    timeOf(view, "on_the_way") ? { label: "On the way", at: timeOf(view, "on_the_way") } : { label: "Waiting for a visit", at: null },
    { label: "Visited", at: timeOf(view, "visited") },
    { label: timeOf(view, "confirmed") ? "Confirmed" : "Result", at: timeOf(view, "confirmed") },
  ];
  const current = rows.findIndex((row) => row.at === null);
  return rows.map((row, index) => ({
    label: row.label,
    time: row.at ? formatTime(row.at) : undefined,
    state: row.at ? "done" : index === current ? "current" : "upcoming",
  }));
}

const RESULTS: Record<NonNullable<ReportStatusView["result"]>, { label: string; tone: StatusDotTone }> = {
  total: { label: "Totally damaged", tone: "danger" },
  partial: { label: "Partially damaged", tone: "warning" },
  none: { label: "No damage", tone: "success" },
};

/** The headline of a confirmed report, or null before a responder confirms one. */
export function resultOf(view: ReportStatusView): { label: string; tone: StatusDotTone; confirmedBy: string | null } | null {
  if (!view.result) return null;
  return { ...RESULTS[view.result], confirmedBy: view.confirmed_by };
}

/** The household line under the code box: "San Isidro, Purok 3". */
export function placeOf(view: ReportStatusView): string {
  return view.purok ? `${view.barangay}, ${view.purok}` : view.barangay;
}

/** Does this live event mean the report on screen changed? */
export function changesReport(event: HubEvent | null, code: string): boolean {
  if (!event) return false;
  if (event.type === "report.updated") return event.code === code;
  if (event.type === "entry.confirmed") return event.report_code === code;
  return false;
}
