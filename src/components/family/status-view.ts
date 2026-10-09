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
 * The four rows a family reads. A step is done once it, or any step after it,
 * has happened, because a responder can visit without marking "on the way".
 * The first step not done is the current one and the rest are upcoming. Only a
 * step with its own time shows a time. Before the visit the second row says
 * "Waiting for a visit", and from "on the way" on it says "On the way". The
 * last row says "Result" until it is confirmed.
 */
export function timelineItems(view: ReportStatusView): TimelineItem[] {
  const received = timeOf(view, "received");
  const onTheWay = timeOf(view, "on_the_way");
  const visited = timeOf(view, "visited");
  const confirmed = timeOf(view, "confirmed");
  const times = [received, onTheWay, visited, confirmed];
  const lastDone = times.findLastIndex((at) => at !== null);

  const labels = ["Received", onTheWay || lastDone >= 2 ? "On the way" : "Waiting for a visit", "Visited", confirmed ? "Confirmed" : "Result"];
  return labels.map((label, index) => ({
    label,
    time: times[index] ? formatTime(times[index]) : undefined,
    state: index <= lastDone ? "done" : index === lastDone + 1 ? "current" : "upcoming",
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
