import type { ReportVerdict } from "@/lib/contracts";

// The two calls a responder or staff screen makes on a family report's photo
// assessment. Each answers null when it worked, else the words to show.

function failure(status: number): string {
  if (status === 401 || status === 403) return "Your session ended. Sign in again.";
  if (status === 409) return "This report changed. Reload the page.";
  return "Could not save. Try again.";
}

async function call(url: string, init: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, init);
    return res.ok ? null : failure(res.status);
  } catch {
    return "Could not reach the hub. Check the Wi-Fi and try again.";
  }
}

/** Saves a verdict: the person's own class and urgency, which replace the AI's on every screen. */
export function saveVerdict(code: string, verdict: { damage_class: ReportVerdict["damage_class"]; urgency: ReportVerdict["urgency"]; note: string | null }) {
  return call(`/api/reports/${code}/assessment`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(verdict),
  });
}

/** Asks the hub to read the photo again, after a failed or stalled reading. */
export function readPhotoAgain(code: string) {
  return call(`/api/reports/${code}/assessment`, { method: "POST" });
}
