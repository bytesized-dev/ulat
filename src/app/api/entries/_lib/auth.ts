import { requireResponder, requireResponderOrStaff, requireStaff } from "@/lib/auth/session";

// Who is calling, from the signed session cookie in src/lib/auth/session.ts.
// Handlers return the Response as is when the caller is not allowed (401).

export type Actor = { role: "responder"; id: string } | { role: "staff"; id: "staff" };

type Allowed = "responder" | "staff" | "either";

export async function authorize(allowed: Allowed): Promise<Actor | Response> {
  const session =
    allowed === "responder"
      ? await requireResponder()
      : allowed === "staff"
        ? await requireStaff()
        : await requireResponderOrStaff();
  if (session instanceof Response) return session;
  return session.role === "responder"
    ? { role: "responder", id: session.responder_id }
    : { role: "staff", id: "staff" };
}
