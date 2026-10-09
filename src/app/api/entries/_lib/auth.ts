// The seam between these routes and CJ's sign-in (src/app/api/auth, not built
// yet). Every handler asks getActor and fails closed when it returns null.
// When the real session lands, replace the body of getActor and nothing else.

export type Actor = { role: "responder"; id: string } | { role: "staff"; id: "staff" };

export function getActor(req: Request): Actor | null {
  // Development only: lets the routes be exercised before sign-in exists.
  if (process.env.NODE_ENV !== "production") {
    const role = req.headers.get("x-ulat-dev-role");
    if (role === "staff") return { role: "staff", id: "staff" };
    const responder = req.headers.get("x-ulat-dev-responder");
    if (role === "responder" && responder) return { role: "responder", id: responder };
  }
  return null;
}

export function deny(actor: Actor | null, allowed: Actor["role"][]): Response | null {
  if (!actor) return Response.json({ error: "not_signed_in" }, { status: 401 });
  if (!allowed.includes(actor.role)) return Response.json({ error: "not_allowed" }, { status: 403 });
  return null;
}
