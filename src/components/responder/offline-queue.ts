import { buildForm } from "./capture";
import type { NewEntryMeta } from "@/lib/contracts";

// Entries saved on the phone while the hub is out of reach. docs/SPEC.md
// section 9. Photos and the note stay as blobs in IndexedDB until the hub takes them.

export type QueuedEntry = {
  id: string;
  saved_at: string;
  meta: NewEntryMeta;
  photos: Blob[];
  note: Blob | null;
};

/** The storage the queue sits on. IndexedDB in the browser, an array in tests. */
export type QueueStore = {
  all: () => Promise<QueuedEntry[]>;
  put: (entry: QueuedEntry) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const DB_NAME = "ulat-responder";
const STORE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const browserStore: QueueStore = {
  all: async () => ((await run("readonly", (s) => s.getAll())) as QueuedEntry[]).sort((a, b) => a.saved_at.localeCompare(b.saved_at)),
  put: async (entry) => void (await run("readwrite", (s) => s.put(entry))),
  remove: async (id) => void (await run("readwrite", (s) => s.delete(id))),
};

export async function enqueue(meta: NewEntryMeta, photos: Blob[], note: Blob | null, store: QueueStore = browserStore): Promise<QueuedEntry> {
  const entry: QueuedEntry = { id: crypto.randomUUID(), saved_at: new Date().toISOString(), meta, photos, note };
  await store.put(entry);
  return entry;
}

/** "3 photos, note" as on the Queue screen. */
export function describeQueued(entry: Pick<QueuedEntry, "photos" | "note">): string {
  const photos = `${entry.photos.length} ${entry.photos.length === 1 ? "photo" : "photos"}`;
  return entry.note ? `${photos}, note` : photos;
}

export type FlushResult = { sent: number; left: number };

/**
 * Sends the queue oldest first. A network failure or a hub error stops the run and
 * keeps everything not yet sent. A 4xx other than 401 can never succeed on retry, so
 * that entry is dropped rather than blocking the ones behind it.
 */
export async function flushQueue(store: QueueStore = browserStore, send: typeof fetch = fetch): Promise<FlushResult> {
  const items = await store.all();
  let sent = 0;
  for (const item of items) {
    let res: Response;
    try {
      res = await send("/api/entries", { method: "POST", body: buildForm(item.meta, item.photos as File[], item.note) });
    } catch {
      break;
    }
    if (res.status === 401 || res.status >= 500) break;
    await store.remove(item.id);
    if (res.ok) sent += 1;
  }
  return { sent, left: (await store.all()).length };
}
