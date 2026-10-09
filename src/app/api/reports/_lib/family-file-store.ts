import { mkdir, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { like } from "drizzle-orm";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import {
  MAX_UNLINKED_VOICE_BYTES,
  MAX_UNLINKED_VOICE_FILES,
  MAX_VOICE_FOLDER_BYTES,
  UNLINKED_VOICE_MAX_AGE_MS,
  VOICE_BLOCK_BYTES,
  VOICE_SWEEP_EVERY_MS,
} from "@/lib/audio-limits";
import {
  MAX_PHOTO_FOLDER_BYTES,
  MAX_UNLINKED_PHOTO_BYTES,
  MAX_UNLINKED_PHOTO_FILES,
  PHOTO_BLOCK_BYTES,
  PHOTO_SWEEP_EVERY_MS,
  UNLINKED_PHOTO_MAX_AGE_MS,
} from "@/lib/photo-limits";
import { uploadDir } from "../../entries/_lib/uploads";

// What a family phone sends before its report, the voice recording and the
// photo, lives apart from responder photos and notes, in
// <uploads>/<kind>/<yyyy-mm-dd>/<id>.<ext>. An id can then only ever find a
// family file of its own kind, and each folder is small enough to scan on each
// upload. The report's voice_path or photo_path keeps the path relative to the
// uploads folder, so /api/files serves it like any other upload. The two kinds
// share every rule below and differ only in the Spec: folder, types, limits and
// the reports column that links the file.

export type Kind = "voice" | "photo";

type Limits = { unlinkedBytes: number; unlinkedFiles: number; folderBytes: number; blockBytes: number; maxAgeMs: number; sweepEveryMs: number };

type Spec = {
  /** The folder under the uploads folder, and the start of every path the reports column holds. */
  folder: Kind;
  /** The extension for each type a family phone can send. The same types the entries route takes. */
  ext: Record<string, string>;
  /** The reports column that holds the linked path. */
  column: typeof reports.voice_path | typeof reports.photo_path;
  limits: Limits;
};

const TYPE_ERROR = { voice: "audio_type_not_allowed", photo: "photo_type_not_allowed" } as const;

// The limits are read when used, not when this file loads, so a test can change them.
const SPECS: Record<Kind, Spec> = {
  voice: {
    folder: "voice",
    ext: {
      "audio/webm": "webm",
      "audio/ogg": "ogg",
      "audio/mp4": "m4a",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/wave": "wav",
    },
    column: reports.voice_path,
    limits: {
      get unlinkedBytes() {
        return MAX_UNLINKED_VOICE_BYTES;
      },
      get unlinkedFiles() {
        return MAX_UNLINKED_VOICE_FILES;
      },
      get folderBytes() {
        return MAX_VOICE_FOLDER_BYTES;
      },
      get blockBytes() {
        return VOICE_BLOCK_BYTES;
      },
      get maxAgeMs() {
        return UNLINKED_VOICE_MAX_AGE_MS;
      },
      get sweepEveryMs() {
        return VOICE_SWEEP_EVERY_MS;
      },
    },
  },
  photo: {
    folder: "photo",
    ext: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
    },
    column: reports.photo_path,
    limits: {
      get unlinkedBytes() {
        return MAX_UNLINKED_PHOTO_BYTES;
      },
      get unlinkedFiles() {
        return MAX_UNLINKED_PHOTO_FILES;
      },
      get folderBytes() {
        return MAX_PHOTO_FOLDER_BYTES;
      },
      get blockBytes() {
        return PHOTO_BLOCK_BYTES;
      },
      get maxAgeMs() {
        return UNLINKED_PHOTO_MAX_AGE_MS;
      },
      get sweepEveryMs() {
        return PHOTO_SWEEP_EVERY_MS;
      },
    },
  },
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Stored = { path: string; bytes: number; modified: number };

// What the hub knows about a folder without walking it. An upload adds to both
// counts, and a report that links a file takes it off the unlinked one. Only a
// sweep, which walks the folder, makes them exact. They live on globalThis so
// the upload route and the reports route share them, whichever bundle each one
// lands in. `linked` is what the last sweep found linked, so a report that
// links a file the sweep already counted as linked does not take it off the
// unlinked count a second time. Each kind has its own counts and its own lock.
type Counts = { total: number; unlinked: number; files: number; sweptAt: number; linked: Set<string> };
type State = { counts?: Counts; lock?: Promise<void> };
const shared = globalThis as unknown as { ulatFamilyFiles?: Record<Kind, State> };
const stateOf = (kind: Kind): State => (shared.ulatFamilyFiles ??= { voice: {}, photo: {} })[kind];

export type StoreResult<K extends Kind> = { ok: true } | { ok: false; error: (typeof TYPE_ERROR)[K] | "storage_full" };

function familyFiles<K extends Kind>(kind: K) {
  const spec = SPECS[kind];
  const state = stateOf(kind);
  const dir = () => join(uploadDir, spec.folder);
  const extensions = new Set(Object.values(spec.ext));

  /** What a file of this size takes on disk: whole blocks, and at least one. */
  const billed = (bytes: number) => Math.max(1, Math.ceil(bytes / spec.limits.blockBytes)) * spec.limits.blockBytes;

  /** Every stored file of this kind, with its size and last write time. */
  async function list(): Promise<Stored[]> {
    const found: Stored[] = [];
    const days = (await readdir(dir()).catch(() => [] as string[])).filter((d) => DAY.test(d));
    for (const day of days) {
      for (const name of await readdir(join(dir(), day)).catch(() => [] as string[])) {
        if (!extensions.has(name.split(".").pop() ?? "")) continue;
        const info = await stat(join(dir(), day, name)).catch(() => null);
        if (info?.isFile()) found.push({ path: `${spec.folder}/${day}/${name}`, bytes: billed(info.size), modified: info.mtimeMs });
      }
    }
    return found;
  }

  /**
   * The relative path of the file stored under this id, or null. It lists the
   * day folders and probes for the file in each, so it never lists a folder
   * that holds files.
   */
  async function find(id: string): Promise<string | null> {
    if (!UUID.test(id)) return null;
    const days = (await readdir(dir()).catch(() => [] as string[])).filter((d) => DAY.test(d)).sort().reverse();
    for (const day of days) {
      for (const ext of extensions) {
        const info = await stat(join(dir(), day, `${id}.${ext}`)).catch(() => null);
        if (info?.isFile()) return `${spec.folder}/${day}/${id}.${ext}`;
      }
    }
    return null;
  }

  /**
   * Runs one store at a time. The check, the sweep, the reservation and the
   * write of one upload all finish before the next upload starts, so a sweep
   * never misses a file still being written and never overwrites another
   * upload's reservation. The queue lives on globalThis, so a dev hot reload
   * keeps it. A failed upload releases in the finally, so it cannot wedge the
   * ones behind it.
   */
  async function exclusive<T>(work: () => Promise<T>): Promise<T> {
    const before = state.lock ?? Promise.resolve();
    let release!: () => void;
    state.lock = new Promise<void>((resolve) => (release = resolve));
    await before;
    try {
      return await work();
    } finally {
      release();
    }
  }

  /**
   * Walks the folder: deletes unlinked files over an hour old, then counts what
   * is left. Sizes are counted as disk blocks, see billed. A file a report
   * links is never deleted.
   */
  async function sweep(now: number): Promise<Counts> {
    const linked = new Set(
      db.select({ path: spec.column }).from(reports).where(like(spec.column, `${spec.folder}/%`)).all().flatMap((r) => (r.path ? [r.path] : [])),
    );
    const counts: Counts = { total: 0, unlinked: 0, files: 0, sweptAt: now, linked };
    for (const file of await list()) {
      const isLinked = linked.has(file.path);
      if (!isLinked && now - file.modified > spec.limits.maxAgeMs) {
        await rm(join(uploadDir, file.path), { force: true }).catch(() => undefined);
        continue;
      }
      counts.total += file.bytes;
      if (!isLinked) {
        counts.unlinked += file.bytes;
        counts.files += 1;
      }
    }
    return (state.counts = counts);
  }

  /** Tells the counts that a report took this file, so it stops counting as unlinked. */
  async function linked(path: string): Promise<void> {
    const counts = state.counts;
    const info = await stat(join(uploadDir, path)).catch(() => null);
    if (!counts || !info || counts.linked.has(path)) return;
    counts.linked.add(path);
    counts.unlinked = Math.max(0, counts.unlinked - billed(info.size));
    counts.files = Math.max(0, counts.files - 1);
  }

  /**
   * Stores a file unless the hub is full. Three caps apply: files no report
   * has taken may total `unlinkedBytes` and `unlinkedFiles` files, and the
   * whole folder may hold `folderBytes`. Every file counts as whole disk
   * blocks, so a tiny one cannot slip under a byte cap. An upload under both
   * caps by the running counts is written with no walk of the folder. One that
   * looks over a cap, or the first after a sweep interval, sweeps first and is
   * judged on the exact counts, so a 507 is never a stale guess. Uploads run
   * one at a time, see exclusive. The phone keeps its copy until the hub
   * accepts the report, so a file swept before its report arrives is sent again.
   */
  async function store(file: File, id: string, at?: number): Promise<StoreResult<K>> {
    const ext = spec.ext[file.type.split(";")[0].trim().toLowerCase()];
    if (!ext) return { ok: false, error: TYPE_ERROR[kind] };
    // Read before waiting for the lock, so a slow upload does not hold up the others.
    const data = Buffer.from(await file.arrayBuffer());
    return exclusive(() => storeExclusively(data, ext, id, at ?? Date.now()));
  }

  async function storeExclusively(data: Buffer, ext: string, id: string, now: number): Promise<StoreResult<K>> {
    // A repeat of the same id changes nothing, except that it makes the file
    // fresh again so the sweep leaves it for the report that is on its way.
    const existing = await find(id);
    if (existing) {
      await utimes(join(uploadDir, existing), new Date(now), new Date(now)).catch(() => undefined);
      return { ok: true };
    }

    const size = billed(data.length);
    const { limits } = spec;
    const over = (c: Counts) =>
      c.unlinked + size > limits.unlinkedBytes || c.total + size > limits.folderBytes || c.files + 1 > limits.unlinkedFiles;
    let counts = state.counts;
    if (!counts || now - counts.sweptAt >= limits.sweepEveryMs || over(counts)) counts = await sweep(now);
    if (over(counts)) return { ok: false, error: "storage_full" };
    // Counted before the write and taken back if the write fails.
    counts.total += size;
    counts.unlinked += size;
    counts.files += 1;

    const day = new Date(now).toISOString().slice(0, 10);
    const target = join(dir(), day, `${id}.${ext}`);
    try {
      await mkdir(join(dir(), day), { recursive: true });
      // wx: two sends of one id at once cannot overwrite each other.
      await writeFile(target, data, { flag: "wx" });
    } catch (error) {
      counts.total -= size;
      counts.unlinked -= size;
      counts.files -= 1;
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    return { ok: true };
  }

  return { find, store, linked };
}

export const voiceFiles = familyFiles("voice");
export const photoFiles = familyFiles("photo");
