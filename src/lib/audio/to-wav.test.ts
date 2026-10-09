import { describe, expect, it } from "vitest";
import { encodeWav, WAV_SAMPLE_RATE } from "./to-wav";

const ascii = (view: DataView, offset: number, length: number) =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));

async function encode(samples: number[], rate?: number) {
  const blob = encodeWav(new Float32Array(samples), rate);
  return { blob, view: new DataView(await blob.arrayBuffer()) };
}

describe("encodeWav", () => {
  it("writes a 44 byte header for 16 kHz mono 16-bit PCM", async () => {
    const { blob, view } = await encode([0, 0.5, -0.5, 1]);
    expect(blob.type).toBe("audio/wav");
    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 12, 4)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(WAV_SAMPLE_RATE);
    expect(view.getUint32(28, true)).toBe(WAV_SAMPLE_RATE * 2);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(view, 36, 4)).toBe("data");
  });

  it("sizes the data chunk and the file from the sample count", async () => {
    const { blob, view } = await encode(new Array(1000).fill(0));
    expect(view.getUint32(40, true)).toBe(2000);
    expect(view.getUint32(4, true)).toBe(36 + 2000);
    expect(blob.size).toBe(44 + 2000);
  });

  it("is about 960 KB for 30 seconds", async () => {
    const { blob } = await encode(new Array(WAV_SAMPLE_RATE * 30).fill(0));
    expect(blob.size).toBe(44 + 960_000);
  });

  it("writes little endian samples and clamps out of range values", async () => {
    const { view } = await encode([0, 1, -1, 2, -2, 0.5]);
    const at = (i: number) => view.getInt16(44 + i * 2, true);
    expect([at(0), at(1), at(2), at(3), at(4)]).toEqual([0, 32767, -32768, 32767, -32768]);
    expect(at(5)).toBe(16383);
  });

  it("takes the sample rate it is given", async () => {
    const { view } = await encode([0], 8000);
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint32(28, true)).toBe(16000);
  });
});
