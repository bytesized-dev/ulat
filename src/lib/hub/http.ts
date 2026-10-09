import type { z } from "zod";

// Body parsing for the hub's JSON routes. A body that is not JSON or does not
// match the contract is a 400 with the Zod issues, so the hub form can show them.

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  const raw = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: Response.json({ error: "bad_request", issues: parsed.error.issues }, { status: 400 }),
  };
}

export const noStore = { "Cache-Control": "no-store" } as const;
