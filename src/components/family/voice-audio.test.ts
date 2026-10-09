import { afterEach, describe, expect, it } from "vitest";
import { setVoiceAudio, voiceAudioUrl } from "./voice-audio";

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
});
