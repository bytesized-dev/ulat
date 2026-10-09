import { AiErrorBody, AiTranslation } from "../contracts/schemas";

// Browser side of POST /api/updates/translate. The drafts are only drafts:
// staff read and fix them before posting, and when this fails they type the
// translations themselves.

export type DraftResult = { ok: true; ceb: string; tl: string } | { ok: false; retry: boolean };

export async function draftTranslations(
  input: { headline: string; message: string },
  fetcher: typeof fetch = fetch,
): Promise<DraftResult> {
  let res: Response;
  try {
    res = await fetcher("/api/updates/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, retry: true };
  }

  const json: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const drafts = AiTranslation.safeParse(json);
    return drafts.success ? { ok: true, ...drafts.data } : { ok: false, retry: true };
  }
  const error = AiErrorBody.safeParse(json);
  return { ok: false, retry: error.success ? error.data.retry : res.status >= 500 };
}
