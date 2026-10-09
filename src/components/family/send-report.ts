import { z } from "zod";
import { Need, ReportCode } from "@/lib/contracts";
import { toNewReport, type ReportDraft } from "./report-draft";

// Pure parts of the send screen: what the family sees in the summary, the
// request to the hub and what they read when it fails. The screen only wires
// them to the page.

const NEED_LABELS: Record<z.infer<typeof Need>, string> = {
  water: "Water",
  food: "Food",
  tarp: "Tarp",
  medicine: "Medicine",
  hygiene_kit: "Hygiene kit",
  baby_needs: "Baby needs",
};

export type SummaryPill = { label: string; dot?: "danger" };

/** The household, where it is and the numbers a family confirms before sending. */
export function summarizeDraft(draft: ReportDraft) {
  const place = [draft.barangay, draft.purok].map((part) => part.trim()).filter(Boolean);
  const pills: SummaryPill[] = [{ label: draft.people === 1 ? "1 person" : `${draft.people} people` }];
  if (draft.hurt > 0) pills.push({ label: `${draft.hurt} hurt`, dot: "danger" });
  if (draft.missing > 0) pills.push({ label: `${draft.missing} missing`, dot: "danger" });
  for (const need of draft.needs) pills.push({ label: NEED_LABELS[need] });
  return { household: draft.household_head.trim(), place: place.join(", "), pills };
}

export type SendResult = { ok: true; code: string } | { ok: false; message: string; retry: boolean };

const UNREACHABLE = "Could not reach the hub. Check the Wi-Fi and try again.";
const CHECK_REPORT = "We could not send your report. Go back and check it.";

/** What the family reads when a report cannot be sent, and whether sending again can help. */
function failure(status: number): { message: string; retry: boolean } {
  if (status === 400 || status === 413) return { message: CHECK_REPORT, retry: false };
  if (status === 429) return { message: "Too many tries. Wait a minute and try again.", retry: true };
  return { message: "The hub could not save your report. Try again.", retry: true };
}

/** True when the draft has everything the hub needs. */
export function canSend(draft: ReportDraft): boolean {
  return toNewReport(draft).success;
}

const Created = z.object({ code: ReportCode });

/**
 * Sends the draft to the hub as a NewReport with consent true. Never throws, and
 * never touches the draft, so a failed send leaves it for another try.
 */
export async function sendReport(draft: ReportDraft, send: typeof fetch = fetch): Promise<SendResult> {
  const body = toNewReport(draft);
  if (!body.success) return { ok: false, message: CHECK_REPORT, retry: false };
  try {
    const res = await send("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.data),
    });
    if (!res.ok) return { ok: false, ...failure(res.status) };
    const created = Created.safeParse(await res.json().catch(() => null));
    // The hub answered without a code, so there is nothing to show. Treat it as a failed send.
    if (!created.success) return { ok: false, ...failure(500) };
    return { ok: true, code: created.data.code };
  } catch {
    return { ok: false, message: UNREACHABLE, retry: true };
  }
}
