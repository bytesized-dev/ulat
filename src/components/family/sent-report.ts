import { z } from "zod";
import { ReportCode } from "@/lib/contracts";

// The report a family has sent: its code and when it went. The send screen
// writes it, and the report sent screen and the status screen read it. It sits
// in localStorage, not with the draft in sessionStorage, so a family that closes
// the tab can still find their code. The draft is cleared once the report sent
// screen opens straight after a send, never when it is opened by its address.

export const SENT_KEY = "ulat.sent-report";

export const SentReport = z.object({
  code: ReportCode,
  /** ISO timestamp in UTC, shown in Philippine time. */
  sent_at: z.iso.datetime(),
});
export type SentReport = z.infer<typeof SentReport>;

type SentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** localStorage in the browser, nothing on the server or where the browser blocks it. */
function browserStorage(): SentStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// What this page load saved, for a browser that refuses to store anything.
let remembered: string | null = null;

/** The stored string, as the screen's store reads it. */
export function readSentRaw(storage: SentStorage | null = browserStorage()): string | null {
  try {
    return storage?.getItem(SENT_KEY) ?? remembered;
  } catch {
    return remembered;
  }
}

/** The sent report in the stored string, or null when there is none or it is not valid. */
export function parseSentReport(raw: string | null): SentReport | null {
  if (!raw) return null;
  try {
    const parsed = SentReport.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Remembers the code. A blocked store must not stop the family from seeing the code, so it is also kept in memory for this page load. */
export function saveSentReport(code: string, at: Date = new Date(), storage: SentStorage | null = browserStorage()): SentReport | null {
  const parsed = SentReport.safeParse({ code, sent_at: at.toISOString() });
  if (!parsed.success) return null;
  remembered = JSON.stringify(parsed.data);
  try {
    storage?.setItem(SENT_KEY, remembered);
  } catch {
    // A full or blocked store only loses the reminder. The report is already sent.
  }
  return parsed.data;
}

export function clearSentReport(storage: SentStorage | null = browserStorage()): void {
  remembered = null;
  try {
    storage?.removeItem(SENT_KEY);
  } catch {
    // Nothing to clear.
  }
}

// The code of the report the send screen just posted, until the report sent
// screen takes it. It lives in memory on purpose: it only has to survive the
// client-side move from one screen to the next, and a reload or a link opened
// later must find nothing, so the draft in progress stays.
let justSent: string | null = null;

/** Called by the send screen once the hub has the report from this draft. */
export function markSentFromDraft(code: string): void {
  justSent = code;
}

/** True once, when `code` is the report the send screen just posted. Then the draft is spent and can go. */
export function takeSentFromDraft(code: string): boolean {
  if (justSent !== code) return false;
  justSent = null;
  return true;
}
