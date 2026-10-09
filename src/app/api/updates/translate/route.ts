import { translate } from "@/lib/ai";
import { aiError, aiFailure } from "@/lib/ai/http";
import { requireStaff } from "@/lib/auth/session";
import { NewUpdate } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = NewUpdate.pick({ headline: true, message: true });

/**
 * The English headline and message to Bisaya and Tagalog drafts. Staff only.
 * Returns AiTranslation. When the model is slow, answers badly or changes a
 * time, number or place, this returns the AI error shape and the hub screen
 * lets staff type the translations themselves.
 */
export async function POST(request: Request) {
  const session = await requireStaff();
  if (session instanceof Response) return session;

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return aiError("bad_request");
  try {
    return Response.json(await translate(body.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return aiFailure(error);
  }
}
