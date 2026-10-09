import type { z } from "zod";
import { readJsonCapped } from "@/app/api/reports/_lib/body";

// Body parsing for the hub's JSON routes. A body that is not JSON or does not
// match the contract is a 400 with the Zod issues, so the hub form can show them.
// POST /api/safe has no session, so the read is capped like POST /api/reports:
// request.json() would buffer a body of any size.

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  const body = await readJsonCapped(request);
  if (!body.ok) return body;
  const parsed = schema.safeParse(body.value);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: Response.json({ error: "bad_request", issues: parsed.error.issues }, { status: 400 }),
  };
}

export const noStore = { "Cache-Control": "no-store" } as const;
