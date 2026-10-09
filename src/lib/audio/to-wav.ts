// Ollama only decodes WAV, and browsers record webm/opus or mp4/AAC. This turns
// a recording into 16 kHz mono 16-bit WAV in the browser before it is sent to
// POST /api/ai/voice. 30 seconds of that is about 960 KB.

export const WAV_SAMPLE_RATE = 16_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const HEADER_BYTES = 44;

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Pure: mono samples from -1 to 1 into a 16-bit PCM WAV file. Out of range samples are clamped. */
export function encodeWav(samples: Float32Array, sampleRate: number = WAV_SAMPLE_RATE): Blob {
  const dataBytes = samples.length * (BITS_PER_SAMPLE / 8);
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);
  const blockAlign = CHANNELS * (BITS_PER_SAMPLE / 8);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // size of the fmt chunk
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.min(1, Math.max(-1, samples[i]));
    view.setInt16(HEADER_BYTES + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Decodes a recording, resamples it to 16 kHz mono and returns it as WAV.
 * Browser only. Rejects if the browser cannot decode the recording.
 */
export async function toWav(recording: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await recording.arrayBuffer());
    const frames = Math.max(1, Math.ceil(decoded.duration * WAV_SAMPLE_RATE));
    // A one channel destination mixes any number of input channels down to mono.
    const offline = new OfflineAudioContext(CHANNELS, frames, WAV_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), WAV_SAMPLE_RATE);
  } finally {
    void context.close().catch(() => {});
  }
}
