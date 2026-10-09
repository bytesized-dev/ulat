import { describe, expect, it, vi } from "vitest";
import fixtures from "../../../seed/ai-fixtures.json";
import { barHeight, formatTimer, micFailure, MIN_AUDIO_BYTES, pickMimeType, readVoiceNote } from "./voice-note";

const note = new Blob([new Uint8Array(MIN_AUDIO_BYTES * 4)], { type: "audio/webm;codecs=opus" });

const reply = (body: unknown, status = 200) => vi.fn(async () => Response.json(body, { status }));

describe("timer", () => {
  it("shows minutes and two digit seconds", () => {
    expect(formatTimer(0)).toBe("0:00");
    expect(formatTimer(14_900)).toBe("0:14");
    expect(formatTimer(30_000)).toBe("0:30");
    expect(formatTimer(-5)).toBe("0:00");
  });
});

describe("recording format", () => {
  it("takes the first format the browser supports", () => {
    expect(pickMimeType(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickMimeType((mime) => mime === "audio/mp4")).toBe("audio/mp4");
    expect(pickMimeType(() => false)).toBeUndefined();
  });
});

describe("microphone failures", () => {
  it("treats a denied or missing microphone as off", () => {
    expect(micFailure(new DOMException("denied", "NotAllowedError"))).toBe("blocked");
    expect(micFailure(new DOMException("insecure", "SecurityError"))).toBe("blocked");
    expect(micFailure(new DOMException("none", "NotFoundError"))).toBe("blocked");
  });

  it("treats any other failure as a note we could not record", () => {
    expect(micFailure(new DOMException("busy", "NotReadableError"))).toBe("failed");
    expect(micFailure(new Error("boom"))).toBe("failed");
  });
});

describe("reading the note", () => {
  it("posts the audio and returns the extract", async () => {
    const send = reply(fixtures.voice);
    const result = await readVoiceNote(note, send as unknown as typeof fetch);
    expect(result.ok && result.extract.transcript).toBe(fixtures.voice.transcript);
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/ai/voice");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("audio")).toBeInstanceOf(File);
  });

  it("is a retry when the hub fails, the reply is not an extract or the transcript is empty", async () => {
    expect(await readVoiceNote(note, reply({ error: "timeout", retry: true }, 504) as unknown as typeof fetch)).toEqual({ ok: false });
    expect(await readVoiceNote(note, reply({ hello: "world" }) as unknown as typeof fetch)).toEqual({ ok: false });
    expect(await readVoiceNote(note, reply({ ...fixtures.voice, transcript: "  " }) as unknown as typeof fetch)).toEqual({ ok: false });
    expect(await readVoiceNote(note, vi.fn().mockRejectedValue(new TypeError("offline")) as unknown as typeof fetch)).toEqual({ ok: false });
  });

  it("does not send a recording that is only a tap", async () => {
    const send = reply(fixtures.voice);
    expect(await readVoiceNote(new Blob([new Uint8Array(10)], { type: "audio/webm" }), send as unknown as typeof fetch)).toEqual({ ok: false });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("waveform", () => {
  it("keeps every bar inside the range the design draws", () => {
    expect(barHeight(0)).toBe(7);
    expect(barHeight(1)).toBe(66);
    expect(barHeight(5)).toBe(66);
    expect(barHeight(-1)).toBe(7);
  });
});
