import { mkdir, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { like } from "drizzle-orm";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import {
  MAX_UNLINKED_VOICE_BYTES,
  MAX_VOICE_FOLDER_BYTES,
  UNLINKED_VOICE_MAX_AGE_MS,
  VOICE_SWEEP_EVERY_MS,
} from "@/lib/audio-limits";
import { uploadDir } from "../../entries/_lib/uploads";

// Family recordings live apart from photos and responder notes, in
// <uploads>/voice/<yyyy-mm-dd>/<voice_id>.<ext>. A voice_id can then only ever
// find a family recording, and the folder is small enough to scan on each
// upload. reports.voice_path keeps the path relative to the uploads folder, so
// /api/files serves it like any other upload.

const VOICE = "voice";
const voiceDir = () => join(uploadDir, VOICE);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The extension for each type a family phone can record. The same types the entries route takes. */
const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};
const EXTENSIONS = new Set(Object.values(EXT));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Recording = { path: string; bytes: number; modified: number };

/** Every stored family recording, with its size and last write time. */
async function listRecordings(): Promise<Recording[]> {
  const found: Recording[] = [];
  const days = (await readdir(voiceDir()).catch(() => [] as string[])).filter((d) => DAY.test(d));
  for (const day of days) {
    for (const name of await readdir(join(voiceDir(), day)).catch(() => [] as string[])) {
      if (!EXTENSIONS.has(name.split(".").pop() ?? "")) continue;
      const info = await stat(join(voiceDir(), day, name)).catch(() => null);
      if (info?.isFile()) found.push({ path: `${VOICE}/${day}/${name}`, bytes: info.size, modified: info.mtimeMs });
    }
  }
  return found;
}

/**
 * The relative path of the recording stored under this voice_id, or null. It
 * lists the day folders and probes for the file in each, so it never lists a
 * folder that holds recordings.
 */
export async function findVoice(voiceId: string): Promise<string | null> {
  if (!UUID.test(voiceId)) return null;
  const days = (await readdir(voiceDir()).catch(() => [] as string[])).filter((d) => DAY.test(d)).sort().reverse();
  for (const day of days) {
    for (const ext of EXTENSIONS) {
      const info = await stat(join(voiceDir(), day, `${voiceId}.${ext}`)).catch(() => null);
      if (info?.isFile()) return `${VOICE}/${day}/${voiceId}.${ext}`;
    }
  }
  return null;
}

// What the hub knows about the folder without walking it. An upload adds to
// both counts, and a report that links a recording takes it off the unlinked
// one. Only a sweep, which walks the folder, makes them exact. They live on
// globalThis so the voice route and the reports route share them, whichever
// bundle each one lands in. `linked` is what the last sweep found linked, so a
// report that links a recording the sweep already counted as linked does not
// take it off the unlinked count a second time.
type Counts = { total: number; unlinked: number; sweptAt: number; linked: Set<string> };
const shared = globalThis as unknown as { ulatVoiceCounts?: Counts; ulatVoiceLock?: Promise<void> };

/**
 * Runs one storeVoice at a time. The check, the sweep, the reservation and the
 * write of one upload all finish before the next upload starts, so a sweep never
 * misses a file still being written and never overwrites another upload's
 * reservation. The queue lives on globalThis, so a dev hot reload keeps it. A
 * failed upload releases in the finally, so it cannot wedge the ones behind it.
 */
async function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const before = shared.ulatVoiceLock ?? Promise.resolve();
  let release!: () => void;
  shared.ulatVoiceLock = new Promise<void>((resolve) => (release = resolve));
  await before;
  try {
    return await work();
  } finally {
    release();
  }
}

/**
 * Walks the voice folder: deletes unlinked recordings over an hour old, then
 * counts what is left. A recording a report links is never deleted.
 */
async function sweep(now: number): Promise<Counts> {
  const linked = new Set(
    db.select({ path: reports.voice_path }).from(reports).where(like(reports.voice_path, `${VOICE}/%`)).all().flatMap((r) => (r.path ? [r.path] : [])),
  );
  const counts: Counts = { total: 0, unlinked: 0, sweptAt: now, linked };
  for (const recording of await listRecordings()) {
    const isLinked = linked.has(recording.path);
    if (!isLinked && now - recording.modified > UNLINKED_VOICE_MAX_AGE_MS) {
      await rm(join(uploadDir, recording.path), { force: true }).catch(() => undefined);
      continue;
    }
    counts.total += recording.bytes;
    if (!isLinked) counts.unlinked += recording.bytes;
  }
  return (shared.ulatVoiceCounts = counts);
}

/** Tells the counts that a report took this recording, so it stops counting as unlinked. */
export async function voiceLinked(path: string): Promise<void> {
  const counts = shared.ulatVoiceCounts;
  const info = await stat(join(uploadDir, path)).catch(() => null);
  if (!counts || !info || counts.linked.has(path)) return;
  counts.linked.add(path);
  counts.unlinked = Math.max(0, counts.unlinked - info.size);
}

export type StoreVoiceResult = { ok: true } | { ok: false; error: "audio_type_not_allowed" | "storage_full" };

/**
 * Stores a recording unless the hub is full. Two caps apply: recordings no
 * report has taken may total MAX_UNLINKED_VOICE_BYTES, and the whole voice
 * folder may hold MAX_VOICE_FOLDER_BYTES. An upload under both caps by the
 * running counts is written with no walk of the folder. One that looks over a
 * cap, or the first after a minute, sweeps first and is judged on the exact
 * counts, so a 507 is never a stale guess. Uploads run one at a time, see
 * exclusive. The phone keeps its copy until the hub accepts the report, so a
 * recording swept before its report arrives is sent again.
 */
export async function storeVoice(file: File, voiceId: string, at?: number): Promise<StoreVoiceResult> {
  const ext = EXT[file.type.split(";")[0].trim().toLowerCase()];
  if (!ext) return { ok: false, error: "audio_type_not_allowed" };
  // Read before waiting for the lock, so a slow upload does not hold up the others.
  const data = Buffer.from(await file.arrayBuffer());
  return exclusive(() => storeExclusively(data, ext, voiceId, at ?? Date.now()));
}

async function storeExclusively(data: Buffer, ext: string, voiceId: string, now: number): Promise<StoreVoiceResult> {
  // A repeat of the same voice_id changes nothing, except that it makes the
  // file fresh again so the sweep leaves it for the report that is on its way.
  const existing = await findVoice(voiceId);
  if (existing) {
    await utimes(join(uploadDir, existing), new Date(now), new Date(now)).catch(() => undefined);
    return { ok: true };
  }

  const size = data.length;
  const over = (c: Counts) => c.unlinked + size > MAX_UNLINKED_VOICE_BYTES || c.total + size > MAX_VOICE_FOLDER_BYTES;
  let counts = shared.ulatVoiceCounts;
  if (!counts || now - counts.sweptAt >= VOICE_SWEEP_EVERY_MS || over(counts)) counts = await sweep(now);
  if (over(counts)) return { ok: false, error: "storage_full" };
  // Counted before the write and taken back if the write fails.
  counts.total += size;
  counts.unlinked += size;

  const day = new Date(now).toISOString().slice(0, 10);
  const target = join(voiceDir(), day, `${voiceId}.${ext}`);
  try {
    await mkdir(join(voiceDir(), day), { recursive: true });
    // wx: two sends of one voice_id at once cannot overwrite each other.
    await writeFile(target, data, { flag: "wx" });
  } catch (error) {
    counts.total -= size;
    counts.unlinked -= size;
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return { ok: true };
}
