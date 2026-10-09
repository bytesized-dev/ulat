import { mkdir, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { uploadDir } from "../../entries/_lib/uploads";

// The disk side of a family attachment, one store per kind: family voice notes
// and family photos. A kind has its own folder, its own counts, its own lock and
// its own sweep, so recordings and photos never share a cap. Files live in
// <uploads>/<folder>/<yyyy-mm-dd>/<id>.<ext>. An id can then only ever find a
// file of its own kind, and the folder is small enough to scan on each upload.
// The report row keeps the path relative to the uploads folder, so /api/files
// serves it like any other upload.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The caps of one kind. Read on every upload, so a changed value applies at once. */
export type StoreLimits = {
  unlinkedBytes: number;
  unlinkedFiles: number;
  folderBytes: number;
  blockBytes: number;
  unlinkedMaxAgeMs: number;
  sweepEveryMs: number;
};

export type StoreKind = {
  /** The folder under the uploads folder, and the key of this kind's counts and lock. */
  folder: string;
  /** The extension for each mime type the kind takes. */
  types: Record<string, string>;
  /** The error a file of another type gets. */
  typeError: string;
  limits: () => StoreLimits;
  /** The paths of this kind that a row in the database links, from the last read. */
  linkedPaths: () => string[];
};

export type StoreResult<E extends string> = { ok: true } | { ok: false; error: E | "storage_full" };

type Counts = { total: number; unlinked: number; files: number; sweptAt: number; linked: Set<string> };
type State = { counts?: Counts; lock?: Promise<void> };

// What the hub knows about a folder without walking it. An upload adds to the
// total, the unlinked bytes and the file count, and a report that links a file
// takes it off the unlinked ones. Only a sweep, which walks the folder, makes
// them exact. They live on globalThis, one entry per kind, so the upload route
// and the reports route share them, whichever bundle each one lands in. `linked`
// is what the last sweep found linked, so a report that links a file the sweep
// already counted as linked does not take it off the unlinked count a second time.
const shared = globalThis as unknown as { ulatUploadStores?: Record<string, State> };
const stateOf = (folder: string): State => ((shared.ulatUploadStores ??= {})[folder] ??= {});

export function createUploadStore<E extends string>(kind: StoreKind & { typeError: E }) {
  const { folder, types } = kind;
  const dir = () => join(uploadDir, folder);
  const extensions = new Set(Object.values(types));
  const state = stateOf(folder);

  /** What a file of this size takes on disk: whole blocks, and at least one. */
  const billed = (bytes: number) => {
    const block = kind.limits().blockBytes;
    return Math.max(1, Math.ceil(bytes / block)) * block;
  };

  type Stored = { path: string; bytes: number; modified: number };

  /** Every stored file of this kind, with its size and last write time. */
  async function list(): Promise<Stored[]> {
    const found: Stored[] = [];
    const days = (await readdir(dir()).catch(() => [] as string[])).filter((d) => DAY.test(d));
    for (const day of days) {
      for (const name of await readdir(join(dir(), day)).catch(() => [] as string[])) {
        if (!extensions.has(name.split(".").pop() ?? "")) continue;
        const info = await stat(join(dir(), day, name)).catch(() => null);
        if (info?.isFile()) found.push({ path: `${folder}/${day}/${name}`, bytes: billed(info.size), modified: info.mtimeMs });
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
        if (info?.isFile()) return `${folder}/${day}/${id}.${ext}`;
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
   * Walks the folder: deletes unlinked files over the age limit, then counts
   * what is left. Sizes are counted as disk blocks, see billed. A file a report
   * links is never deleted.
   */
  async function sweep(now: number): Promise<Counts> {
    const linked = new Set(kind.linkedPaths());
    const { unlinkedMaxAgeMs } = kind.limits();
    const counts: Counts = { total: 0, unlinked: 0, files: 0, sweptAt: now, linked };
    for (const file of await list()) {
      const isLinked = linked.has(file.path);
      if (!isLinked && now - file.modified > unlinkedMaxAgeMs) {
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
   * Stores a file unless the hub is full. Three caps apply: files no report has
   * taken may total `unlinkedBytes` and `unlinkedFiles` files, and the whole
   * folder may hold `folderBytes`. Every file counts as whole disk blocks, so a
   * tiny one cannot slip under a byte cap. An upload under all caps by the
   * running counts is written with no walk of the folder. One that looks over a
   * cap, or the first after the sweep interval, sweeps first and is judged on
   * the exact counts, so a 507 is never a stale guess. Uploads run one at a
   * time, see exclusive. The phone keeps its copy until the hub accepts the
   * report, so a file swept before its report arrives is sent again.
   */
  async function store(file: File, id: string, at?: number): Promise<StoreResult<E>> {
    const ext = types[file.type.split(";")[0].trim().toLowerCase()];
    if (!ext) return { ok: false, error: kind.typeError };
    // Read before waiting for the lock, so a slow upload does not hold up the others.
    const data = Buffer.from(await file.arrayBuffer());
    return exclusive(() => storeExclusively(data, ext, id, at ?? Date.now()));
  }

  async function storeExclusively(data: Buffer, ext: string, id: string, now: number): Promise<StoreResult<E>> {
    // A repeat of the same id changes nothing, except that it makes the file
    // fresh again so the sweep leaves it for the report that is on its way.
    const existing = await find(id);
    if (existing) {
      await utimes(join(uploadDir, existing), new Date(now), new Date(now)).catch(() => undefined);
      return { ok: true };
    }

    const limits = kind.limits();
    const size = billed(data.length);
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
