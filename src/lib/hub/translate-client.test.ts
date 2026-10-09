import { describe, expect, it, vi } from "vitest";
import { draftTranslations } from "./translate-client";

const input = { headline: "Water at the town plaza, 3 to 5 PM", message: "Bring a container." };
const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

describe("draftTranslations", () => {
  it("sends the English and returns both drafts", async () => {
    const fetcher = reply(200, { ceb: "Tubig sa plaza", tl: "Tubig sa plaza" });
    expect(await draftTranslations(input, fetcher)).toEqual({ ok: true, ceb: "Tubig sa plaza", tl: "Tubig sa plaza" });
    expect(fetcher).toHaveBeenCalledWith("/api/updates/translate", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
  });

  it("passes on the retry flag from the AI error body", async () => {
    expect(await draftTranslations(input, reply(504, { error: "timeout", retry: true }))).toEqual({ ok: false, retry: true });
    expect(await draftTranslations(input, reply(400, { error: "bad_request", retry: false }))).toEqual({ ok: false, retry: false });
  });

  it("fails safely on a bad reply or no network", async () => {
    expect(await draftTranslations(input, reply(200, { ceb: "only one" }))).toEqual({ ok: false, retry: true });
    expect(await draftTranslations(input, reply(502, "<html>"))).toEqual({ ok: false, retry: true });
    expect(await draftTranslations(input, reply(401, { error: "unauthorized" }))).toEqual({ ok: false, retry: false });
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await draftTranslations(input, offline)).toEqual({ ok: false, retry: true });
  });
});
