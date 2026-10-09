import { buildForm } from "./capture";
import type { NewEntryMeta } from "@/lib/contracts";

// Entries saved on the phone while the hub is out of reach. docs/SPEC.md
// section 9. Photos and the note stay as blobs in IndexedDB until the hub takes them.

export type QueueFailure = { status: number; message: string };

export type QueuedEntry = {
  id: string;
  saved_at: string;
  meta: NewEntryMeta;
  photos: Blob[];
  note: Blob | null;
  /** Set when the hub refused the entry for good. It stays until the responder dismisses it. */
  failure?: QueueFailure;
};

/** Tells every /r page the queue changed, so it reads the queue and tries to send. */
export const QUEUE_EVENT = "ulat:responder-queue";

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

export type FlushResult = { sent: number; left: number; failed: number; signedOut: boolean };

/** The queue row for an entry the hub refused. Says what is wrong, since trying again will not help. */
export function failureText(status: number, code: string | undefined): string {
  if (status === 404 || code === "report_not_found") return "That family report was not found.";
  if (status === 413 || code?.endsWith("_size_not_allowed")) return "A file is too big for the hub.";
  if (code?.endsWith("_type_not_allowed")) return "A file type is not supported.";
  if (code === "photo_count") return "The hub needs one to three photos.";
  if (status === 400) return "The hub could not read this entry.";
  if (status === 403) return "This account cannot send entries.";
  return "The hub refused this entry.";
}

/** A lost session or a hub that is busy or down can succeed later, so the run stops and keeps everything. */
function worthRetrying(status: number): boolean {
  return status === 401 || status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * Sends the queue oldest first. A network failure, a lost session or a hub that
 * says try later (408, 425, 429, 5xx) stops the run and keeps everything not yet
 * sent. Any other refusal can never succeed on retry, so the entry stays with its
 * error for the responder to read and dismiss, and the ones behind it still go.
 */
export async function flushQueue(store: QueueStore = browserStore, send: typeof fetch = fetch): Promise<FlushResult> {
  const items = await store.all();
  let sent = 0;
  let signedOut = false;
  for (const item of items) {
    if (item.failure) continue;
    let res: Response;
    try {
      res = await send("/api/entries", { method: "POST", body: buildForm(item.meta, item.photos as File[], item.note) });
    } catch {
      break;
    }
    if (res.ok) {
      await store.remove(item.id);
      sent += 1;
      continue;
    }
    if (worthRetrying(res.status)) {
      signedOut = res.status === 401;
      break;
    }
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    await store.put({ ...item, failure: { status: res.status, message: failureText(res.status, body?.error) } });
  }
  const rest = await store.all();
  return { sent, left: rest.filter((e) => !e.failure).length, failed: rest.filter((e) => e.failure).length, signedOut };
}
