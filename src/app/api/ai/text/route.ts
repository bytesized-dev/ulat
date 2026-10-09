import { z } from "zod";
import { aiError, aiFailure } from "@/lib/ai/http";
import { readText } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 500 is the limit on the type instead screen.
const Body = z.object({ text: z.string().trim().min(1).max(500) });

/** A typed note to fields. Returns AiVoiceExtract with an empty transcript. */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return aiError("bad_request");
  try {
    return Response.json(await readText({ text: body.data.text }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return aiFailure(error);
  }
}
