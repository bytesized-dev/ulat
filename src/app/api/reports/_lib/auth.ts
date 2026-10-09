import { requireResponder, requireStaff } from "@/lib/auth/session";

// Families have no session. The list and desk intake ask getActor and fail
// closed when it returns null. The session itself is CJ's (BYT-54).

export type Actor = { role: "responder"; id: string } | { role: "staff"; id: "staff" };

async function asStaff(): Promise<Actor | null> {
  return (await requireStaff()) instanceof Response ? null : { role: "staff", id: "staff" };
}

async function asResponder(): Promise<Actor | null> {
  const responder = await requireResponder();
  return responder instanceof Response ? null : { role: "responder", id: responder.responder_id };
}

/**
 * A laptop can hold both cookies. Staff win by default, so it can still file desk
 * reports. A route only a responder may call passes "responder" to be answered by
 * that session instead of getting a 403 for the staff one.
 */
export async function getActor(prefer: Actor["role"] = "staff"): Promise<Actor | null> {
  const order = prefer === "staff" ? [asStaff, asResponder] : [asResponder, asStaff];
  for (const find of order) {
    const actor = await find();
    if (actor) return actor;
  }
  return null;
}

export function deny(actor: Actor | null, allowed: Actor["role"][]): Response | null {
  if (!actor) return Response.json({ error: "not_signed_in" }, { status: 401 });
  if (!allowed.includes(actor.role)) return Response.json({ error: "not_allowed" }, { status: 403 });
  return null;
}
