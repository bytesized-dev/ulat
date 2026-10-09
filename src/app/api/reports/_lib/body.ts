// POST /api/reports has no session, so the body is capped before it is parsed.
// req.json() buffers everything it is given. The longest honest report is about
// 5 KB of text (20 KB if every character takes four bytes), so 32 KB is a wide
// margin and still turns away a junk body.
export const MAX_BODY_BYTES = 32 * 1024;

export type JsonBody = { ok: true; value: unknown } | { ok: false; response: Response };

const tooLarge = () => ({ ok: false, response: Response.json({ error: "too_large" }, { status: 413 }) }) as const;

export async function readJsonCapped(req: Request, max = MAX_BODY_BYTES): Promise<JsonBody> {
  // Content-Length lets a big body be refused without reading any of it.
  const length = req.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length) && Number(length) > max) return tooLarge();

  // A chunked request has no Content-Length, and the header can lie, so the
  // bytes are counted as they arrive and the read stops at the cap.
  const reader = req.body?.getReader();
  if (!reader) return { ok: false, response: Response.json({ error: "bad_json" }, { status: 400 }) };
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return tooLarge();
    }
    chunks.push(value);
  }

  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, response: Response.json({ error: "bad_json" }, { status: 400 }) };
  }
}
