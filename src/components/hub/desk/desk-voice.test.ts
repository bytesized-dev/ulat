import { describe, expect, it } from "vitest";
import { formatTimer, micFailure, pickMimeType, readVoiceNote } from "./desk-voice";

const extract = {
  language: "en",
  transcript: "Four of us, the roof fell in",
  english: "Four of us, the roof fell in",
  household_head: null,
  people: 4,
  hurt: null,
  missing: null,
  what_happened: "Roof fell in",
  needs: [],
  hazards: [],
  uncertain_fields: [],
};

const note = (size = 5000) => new Blob([new Uint8Array(size)], { type: "audio/webm" });
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe("formatTimer", () => {
  it("shows minutes and seconds", () => {
    expect(formatTimer(0)).toBe("0:00");
    expect(formatTimer(14_900)).toBe("0:14");
    expect(formatTimer(30_000)).toBe("0:30");
    expect(formatTimer(-5)).toBe("0:00");
  });
});

describe("pickMimeType", () => {
  it("takes the first format the browser can record", () => {
    expect(pickMimeType((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickMimeType(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickMimeType(() => false)).toBeUndefined();
  });
});

describe("micFailure", () => {
  it("separates a blocked microphone from one that failed", () => {
    expect(micFailure(new DOMException("no", "NotAllowedError"))).toBe("blocked");
    expect(micFailure(new DOMException("none", "NotFoundError"))).toBe("blocked");
    expect(micFailure(new DOMException("busy", "NotReadableError"))).toBe("failed");
    expect(micFailure(new Error("x"))).toBe("failed");
  });
});

describe("readVoiceNote", () => {
  it("returns the extract from a valid reply", async () => {
    const result = await readVoiceNote(note(), reply(200, extract));
    expect(result).toMatchObject({ ok: true, extract: { people: 4 } });
  });

  it("sends the audio as multipart to the voice route", async () => {
    let seen: { url: string; body?: BodyInit | null } | null = null;
    const spy = (async (url: RequestInfo | URL, init?: RequestInit) => {
      seen = { url: String(url), body: init?.body };
      return new Response(JSON.stringify(extract));
    }) as typeof fetch;
    await readVoiceNote(note(), spy);
    expect(seen!.url).toBe("/api/ai/voice");
    expect((seen!.body as FormData).get("audio")).toBeInstanceOf(File);
  });

  it("fails on a tap that recorded nothing, a bad reply, an empty transcript and an error", async () => {
    expect(await readVoiceNote(note(10), reply(200, extract))).toEqual({ ok: false });
    expect(await readVoiceNote(note(), reply(200, { people: "four" }))).toEqual({ ok: false });
    expect(await readVoiceNote(note(), reply(200, { ...extract, transcript: "  " }))).toEqual({ ok: false });
    expect(await readVoiceNote(note(), reply(503, { error: "unavailable", retry: true }))).toEqual({ ok: false });
  });
});
