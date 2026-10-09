import { afterEach, describe, expect, it } from "vitest";
import { setVoiceAudio, voiceAudioBlob, voiceAudioUrl, voiceFileName } from "./voice-audio";

afterEach(() => setVoiceAudio(null));

describe("voice audio", () => {
  it("has nothing until a recording is kept", () => {
    expect(voiceAudioUrl()).toBeNull();
  });

  it("gives the same address until the recording changes", () => {
    setVoiceAudio(new Blob(["a"], { type: "audio/webm" }));
    const first = voiceAudioUrl();
    expect(first).toMatch(/^blob:/);
    expect(voiceAudioUrl()).toBe(first);
    setVoiceAudio(new Blob(["b"], { type: "audio/webm" }));
    expect(voiceAudioUrl()).not.toBe(first);
  });

  it("forgets the recording when cleared", () => {
    setVoiceAudio(new Blob(["a"], { type: "audio/webm" }));
    setVoiceAudio(null);
    expect(voiceAudioUrl()).toBeNull();
  });

  it("hands the send screen the recording itself, and names it from its type", () => {
    const note = new Blob(["a"], { type: "audio/mp4" });
    setVoiceAudio(note);
    expect(voiceAudioBlob()).toBe(note);
    setVoiceAudio(null);
    expect(voiceAudioBlob()).toBeNull();
    expect(voiceFileName(new Blob([], { type: "audio/webm;codecs=opus" }))).toBe("note.webm");
    expect(voiceFileName(new Blob([], { type: "audio/mp4" }))).toBe("note.mp4");
    expect(voiceFileName(new Blob([]))).toBe("note.webm");
  });
});
