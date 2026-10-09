import { HubEvent, ReportCode } from "@/lib/contracts";

// Who is on the other end of a stream. A family sees only its own report, by
// code. With no code it still gets updates and places.
export type Viewer =
  | { role: "family"; code: string | null }
  | { role: "responder" }
  | { role: "staff" };

export function canSee(viewer: Viewer, event: HubEvent): boolean {
  if (viewer.role !== "family") return true;
  switch (event.type) {
    case "update.posted":
    case "place.saved":
      return true;
    case "report.created":
    case "report.updated":
      return viewer.code !== null && event.code === viewer.code;
    case "entry.confirmed":
      return viewer.code !== null && event.report_code === viewer.code;
    default:
      return false;
  }
}

export type ViewerResult = { ok: true; viewer: Viewer } | { ok: false };

// BYT-54 replaces this with the session check. Until then every stream is a
// family stream, which is privacy safe: nobody sees more than their own code.
export function viewerFromRequest(request: Request): ViewerResult {
  const raw = new URL(request.url).searchParams.get("code");
  if (raw === null) return { ok: true, viewer: { role: "family", code: null } };
  const code = ReportCode.safeParse(raw);
  if (!code.success) return { ok: false };
  return { ok: true, viewer: { role: "family", code: code.data } };
}
