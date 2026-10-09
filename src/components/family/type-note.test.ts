import { describe, expect, it, vi } from "vitest";
import { AiVoiceExtract } from "@/lib/contracts";
import fixtures from "../../../seed/ai-fixtures.json";
import { emptyDraft } from "./report-draft";
import { draftFromNote, NOTE_LIMIT, readNote } from "./type-note";

const extract = AiVoiceExtract.parse(fixtures.text);

function reply(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

describe("type instead", () => {
  it("allows 500 characters, the limit of the AI route", () => {
    expect(NOTE_LIMIT).toBe(500);
  });

  it("posts the trimmed text to the text route and returns the extract", async () => {
    const send = reply(200, extract);
    const result = await readNote("  Five of us live here.  ", send);
    expect(result).toEqual({ ok: true, extract });
    expect(send).toHaveBeenCalledOnce();
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("/api/ai/text");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ text: "Five of us live here." });
  });

  it("treats an answer that fails the schema as a failure to retry", async () => {
    const result = await readNote("Hello", reply(200, { people: "many" }));
    expect(result).toMatchObject({ ok: false, retry: true });
  });

  it("only offers a retry when the hub says it can help", async () => {
    expect(await readNote("Hello", reply(504, { error: "timeout", retry: true }))).toMatchObject({ ok: false, retry: true });
    expect(await readNote("Hello", reply(422, { error: "rejected", retry: false }))).toMatchObject({ ok: false, retry: false });
  });

  it("explains a hub that cannot be reached", async () => {
    const result = await readNote("Hello", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline")));
    expect(result).toEqual({ ok: false, message: "Could not reach the hub. Check the Wi-Fi and try again.", retry: true });
  });

  it("keeps the family's words as the transcript and drops an earlier recording", () => {
    const before = { ...emptyDraft(), voice_id: crypto.randomUUID(), barangay: "Dapitan" };
    const draft = draftFromNote(before, "  Five of us live here.  ", extract);
    expect(draft.transcript).toBe("Five of us live here.");
    expect(draft.voice_id).toBeNull();
    expect(draft.barangay).toBe("Dapitan");
    expect(draft.people).toBe(extract.people ?? 0);
    expect(draft.uncertain_fields).toEqual(extract.uncertain_fields);
  });

  it("uses no punctuation the copy rules forbid in its messages", async () => {
    for (const error of ["bad_request", "too_large", "rejected", "timeout", "unavailable", "invalid_output"] as const) {
      const result = await readNote("Hello", reply(500, { error, retry: true }));
      const message = result.ok ? "" : result.message;
      expect(message).not.toContain("!");
      expect(message).not.toContain(String.fromCharCode(0x2013));
      expect(message).not.toContain(String.fromCharCode(0x2014));
    }
  });
});
