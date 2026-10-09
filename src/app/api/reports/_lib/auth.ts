import { requireResponder, requireStaff } from "@/lib/auth/session";

// Families have no session. The list and desk intake ask getActor and fail
// closed when it returns null. The session itself is CJ's (BYT-54).

export type Actor = { role: "responder"; id: string } | { role: "staff"; id: "staff" };

export async function getActor(): Promise<Actor | null> {
  // Staff first, so a laptop that also holds a responder cookie can still file desk reports.
  const staff = await requireStaff();
  if (!(staff instanceof Response)) return { role: "staff", id: "staff" };
  const responder = await requireResponder();
  if (!(responder instanceof Response)) return { role: "responder", id: responder.responder_id };
  return null;
}

export function deny(actor: Actor | null, allowed: Actor["role"][]): Response | null {
  if (!actor) return Response.json({ error: "not_signed_in" }, { status: 401 });
  if (!allowed.includes(actor.role)) return Response.json({ error: "not_allowed" }, { status: 403 });
  return null;
}
