import { readActiveResponder, readSession, SESSION_COOKIE } from "@/lib/auth/session";
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

export function cookieValue(request: Request, name: string): string | undefined {
  for (const part of request.headers.get("cookie")?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

// A valid staff session gets every event, and so does a responder session while
// the responder is still active. Anyone else is a family: a forged, expired or
// switched-off cookie is not an error, it just gets the family view, which is
// limited to the code in ?code= (checked with ReportCode) plus updates and
// places. The role is fixed when the stream opens, so a session that ends later
// keeps its stream until the client reconnects.
export async function viewerFromRequest(request: Request): Promise<ViewerResult> {
  if (await readSession("staff", cookieValue(request, SESSION_COOKIE.staff))) {
    return { ok: true, viewer: { role: "staff" } };
  }
  if (await readActiveResponder(cookieValue(request, SESSION_COOKIE.responder))) {
    return { ok: true, viewer: { role: "responder" } };
  }

  const raw = new URL(request.url).searchParams.get("code");
  if (raw === null) return { ok: true, viewer: { role: "family", code: null } };
  const code = ReportCode.safeParse(raw);
  if (!code.success) return { ok: false };
  return { ok: true, viewer: { role: "family", code: code.data } };
}
