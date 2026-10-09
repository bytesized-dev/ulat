import { mkdir, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { like } from "drizzle-orm";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { MAX_UNLINKED_VOICE_BYTES, UNLINKED_VOICE_MAX_AGE_MS } from "@/lib/audio-limits";
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

/** The relative path of the recording stored under this voice_id, or null. */
export async function findVoice(voiceId: string): Promise<string | null> {
  if (!UUID.test(voiceId)) return null;
  const days = (await readdir(voiceDir()).catch(() => [] as string[])).filter((d) => DAY.test(d)).sort().reverse();
  for (const day of days) {
    const names = await readdir(join(voiceDir(), day)).catch(() => [] as string[]);
    const name = names.find((n) => n.startsWith(`${voiceId}.`) && EXTENSIONS.has(n.slice(voiceId.length + 1)));
    if (name) return `${VOICE}/${day}/${name}`;
  }
  return null;
}

export type StoreVoiceResult = { ok: true } | { ok: false; error: "audio_type_not_allowed" | "storage_full" };

/**
 * Deletes unlinked recordings older than an hour, then stores this one unless
 * the unlinked ones already take MAX_UNLINKED_VOICE_BYTES. A recording a report
 * links is never deleted. The phone keeps its copy until the hub has accepted
 * the report, so a recording swept before its report arrives is sent again.
 */
export async function storeVoice(file: File, voiceId: string, now = Date.now()): Promise<StoreVoiceResult> {
  const ext = EXT[file.type.split(";")[0].trim().toLowerCase()];
  if (!ext) return { ok: false, error: "audio_type_not_allowed" };

  // A repeat of the same voice_id changes nothing, except that it makes the
  // file fresh again so the sweep leaves it for the report that is on its way.
  const existing = await findVoice(voiceId);
  if (existing) {
    await utimes(join(uploadDir, existing), new Date(now), new Date(now)).catch(() => undefined);
    return { ok: true };
  }

  const linked = new Set(
    db.select({ path: reports.voice_path }).from(reports).where(like(reports.voice_path, `${VOICE}/%`)).all().map((r) => r.path),
  );
  let unlinkedBytes = 0;
  for (const recording of await listRecordings()) {
    if (linked.has(recording.path)) continue;
    if (now - recording.modified > UNLINKED_VOICE_MAX_AGE_MS) {
      await rm(join(uploadDir, recording.path), { force: true }).catch(() => undefined);
    } else {
      unlinkedBytes += recording.bytes;
    }
  }
  if (unlinkedBytes + file.size > MAX_UNLINKED_VOICE_BYTES) return { ok: false, error: "storage_full" };

  const day = new Date(now).toISOString().slice(0, 10);
  await mkdir(join(voiceDir(), day), { recursive: true });
  try {
    // wx: two sends of one voice_id at once cannot overwrite each other.
    await writeFile(join(voiceDir(), day, `${voiceId}.${ext}`), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return { ok: true };
}
