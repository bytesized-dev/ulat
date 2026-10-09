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
