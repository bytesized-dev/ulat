import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OllamaError } from "./ollama";

// Ollama 0.40.2 hears audio only as WAV. The webm, ogg and mp4 notes that
// phones record come back as 400 "media expansion produced no tokens", and an
// mp3 as "unrecognized audio format". So every voice note goes through ffmpeg
// on the hub first, the same conversion eval/voice-scripts.md uses.

const CONVERT_TIMEOUT_MS = 15_000;

/** The model hears at most this much, the same limit as the recorder. */
const MAX_SECONDS = 30;

/**
 * FFMPEG_PATH, else Homebrew's ffmpeg, else the one on PATH. A server started
 * outside a login shell often has no Homebrew folder on its PATH.
 */
function ffmpegPath(): string {
  return process.env.FFMPEG_PATH || ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"].find((path) => existsSync(path)) || "ffmpeg";
}

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath(), args, { timeout: CONVERT_TIMEOUT_MS }, (error, _stdout, stderr) => {
      if (!error) return resolve();
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return reject(new OllamaError("unavailable", "ffmpeg not found on the hub. Install it with: brew install ffmpeg"));
      }
      if (error.killed) return reject(new OllamaError("timeout", `ffmpeg took over ${CONVERT_TIMEOUT_MS / 1000} seconds`));
      reject(new OllamaError("rejected", "ffmpeg could not read the audio", String(stderr).trim() || null));
    });
  });
}

// Given a silent note, Gemma does not say so. It writes a believable report,
// with people, hurt and missing filled in, so a note without speech must never
// reach it. The check looks for loud stretches against the note's own quiet
// parts, because the phone's gain control lifts a silent room's hiss.

/** 20 ms of 16 kHz audio. */
const FRAME_SAMPLES = 320;
/** Speech is this many dB above the quiet parts around it. */
const SPEECH_OVER_FLOOR_DB = 12;
/** Anything quieter than this is not speech, however still the room is. */
const SPEECH_MIN_DBFS = -50;
/** The quiet parts are measured over about a second each side. */
const FLOOR_WINDOW_FRAMES = 50;
/**
 * A note needs 0.6 seconds of speech. "Recording, test mic" has about 1.2, and
 * a cough or two taps on the phone stay under it.
 */
const MIN_SPEECH_FRAMES = 30;

/** The 16-bit samples in a WAV file, found by walking its chunks. Empty if there is no data chunk. */
function pcmSamples(wav: Buffer): Int16Array {
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("latin1", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (id === "data") {
      const end = Math.min(wav.length, offset + 8 + size);
      const bytes = wav.subarray(offset + 8, end - ((end - offset - 8) % 2));
      return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
    }
    offset += 8 + size + (size % 2);
  }
  return new Int16Array(0);
}

/** Loudness per frame in dB below full scale. */
function frameLevels(samples: Int16Array): number[] {
  const levels: number[] = [];
  for (let start = 0; start + FRAME_SAMPLES <= samples.length; start += FRAME_SAMPLES) {
    let sum = 0;
    for (let i = start; i < start + FRAME_SAMPLES; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / FRAME_SAMPLES);
    levels.push(rms === 0 ? -120 : 20 * Math.log10(rms / 32768));
  }
  return levels;
}

/** The 10th percentile, so one dropout does not set the floor. */
function quietLevel(levels: number[]): number {
  const sorted = [...levels].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.1)];
}

/** How many 20 ms frames of a 16 kHz mono WAV sound like speech. */
export function speechFrames(wav: Buffer): number {
  const levels = frameLevels(pcmSamples(wav));
  let speech = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] < SPEECH_MIN_DBFS) continue;
    const floor = quietLevel(levels.slice(Math.max(0, i - FLOOR_WINDOW_FRAMES), i + FLOOR_WINDOW_FRAMES + 1));
    if (levels[i] - floor >= SPEECH_OVER_FLOOR_DB) speech++;
  }
  return speech;
}

/** True when a 16 kHz mono WAV from toWav holds enough speech to send to the model. */
export function hasSpeech(wav: Buffer): boolean {
  return speechFrames(wav) >= MIN_SPEECH_FRAMES;
}

/**
 * Any recording ffmpeg can read, as 16 kHz mono 16-bit WAV, cut at 30 seconds.
 * Failures are OllamaErrors so the route answers them like a failed model
 * call: unavailable when ffmpeg is missing, timeout, or rejected when the
 * file holds no audio ffmpeg can read.
 */
export async function toWav(audio: Buffer): Promise<Buffer> {
  // Files, not pipes: an mp4 can keep its index at the end, where ffmpeg cannot seek on a pipe.
  const dir = await mkdtemp(join(tmpdir(), "ulat-voice-"));
  try {
    const input = join(dir, "note");
    const output = join(dir, "note.wav");
    await writeFile(input, audio);
    await run(["-nostdin", "-hide_banner", "-loglevel", "error", "-i", input, "-vn", "-t", String(MAX_SECONDS), "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", output]);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
