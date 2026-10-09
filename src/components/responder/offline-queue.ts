import { buildForm } from "./capture";
import { newClientId } from "@/lib/client-id";
import { NewEntryMeta } from "@/lib/contracts";
import { parseRetryAfter } from "./retry-backoff";

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
  // The row id uses the same helper: crypto.randomUUID is missing on a page served over plain HTTP.
  const entry: QueuedEntry = { id: newClientId(), saved_at: new Date().toISOString(), meta: { ...meta, client_id: meta.client_id ?? newClientId() }, photos, note };
  await store.put(entry);
  return entry;
}

/** "3 photos, note" as on the Queue screen. */
export function describeQueued(entry: Pick<QueuedEntry, "photos" | "note">): string {
  const photos = `${entry.photos.length} ${entry.photos.length === 1 ? "photo" : "photos"}`;
  return entry.note ? `${photos}, note` : photos;
}

export type FlushResult = {
  sent: number;
  left: number;
  failed: number;
  /** The hub said 401. Nothing more should be posted until the responder signs in again. */
  signedOut: boolean;
  /** The run stopped on a failure that can pass: no answer, a timeout, 408, 425, 429 or 5xx. */
  retry: boolean;
  /** The hub's Retry-After on a 429 or 503, in milliseconds. */
  retryAfterMs: number | null;
};

/** A small entry gets this long for one POST. */
export const SEND_TIMEOUT_BASE_MS = 60_000;
/** Each megabyte of photos and note adds this much, so a 30 MB entry on weak Wi-Fi is not cut off at the base. */
export const SEND_TIMEOUT_PER_MB_MS = 10_000;
/** No POST is given longer than this, so one stuck upload cannot hold the run for more than ten minutes. */
export const SEND_TIMEOUT_CAP_MS = 600_000;

/** How long one POST of this many bytes may take before the phone gives up on it and tries later. */
export function sendTimeoutMs(bytes: number): number {
  return Math.min(SEND_TIMEOUT_CAP_MS, SEND_TIMEOUT_BASE_MS + Math.ceil(bytes / 1_000_000) * SEND_TIMEOUT_PER_MB_MS);
}

function payloadBytes(item: Pick<QueuedEntry, "photos" | "note">): number {
  return item.photos.reduce((sum, photo) => sum + photo.size, 0) + (item.note?.size ?? 0);
}

function timedOut(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

/** The queue row for an entry the hub refused. Says what is wrong, since trying again will not help. */
export function failureText(status: number, code: string | undefined): string {
  if (code === "client_id_taken") return "Another responder already used this entry's ID. Dismiss it and take the entry again.";
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
 * sent. The result says which, so the caller can wait before the next run. Any other refusal can never succeed on retry, so the entry stays with its
 * error for the responder to read and dismiss, and the ones behind it still go.
 *
 * A POST that outruns its timeout does not stop the run: the entries behind it
 * still go, and the result asks for a retry so the backoff covers the one that
 * timed out. `stalled` remembers those entries between runs, and a stalled entry
 * goes last so it cannot hold up the rest again. The hub may have saved it before
 * the phone gave up, which is safe because every try carries the same client_id.
 * A 200 means the hub already had the entry, and counts as sent like a 201.
 */
export async function flushQueue(store: QueueStore = browserStore, send: typeof fetch = fetch, stalled: Set<string> = new Set()): Promise<FlushResult> {
  const all = await store.all();
  // Dismissed and sent entries leave the set, so it holds only what is still in the queue.
  const present = new Set(all.map((e) => e.id));
  for (const id of stalled) if (!present.has(id)) stalled.delete(id);
  const items = [...all].sort((a, b) => Number(stalled.has(a.id)) - Number(stalled.has(b.id)));
  let sent = 0;
  let signedOut = false;
  let retry = false;
  let retryAfterMs: number | null = null;
  for (let item of items) {
    if (item.failure) continue;
    if (!item.meta.client_id) {
      // Saved before the phone sent ids. The id is stored before the first send, so a lost reply is resent under the same one.
      // The row id was made by randomUUID, so it serves as the client id. Two tabs without a Web Lock
      // (plain HTTP) then agree on it, and the hub sees one id however many of them send.
      item = { ...item, meta: { ...item.meta, client_id: NewEntryMeta.shape.client_id.safeParse(item.id).success ? item.id : newClientId() } };
      try {
        await store.put(item);
      } catch {
        retry = true;
        break;
      }
    }
    let res: Response;
    try {
      res = await send("/api/entries", {
        method: "POST",
        body: buildForm(item.meta, item.photos as File[], item.note),
        signal: AbortSignal.timeout(sendTimeoutMs(payloadBytes(item))),
      });
    } catch (error) {
      retry = true;
      if (timedOut(error)) {
        stalled.add(item.id);
        continue;
      }
      break;
    }
    if (res.ok) {
      stalled.delete(item.id);
      await store.remove(item.id);
      sent += 1;
      continue;
    }
    if (worthRetrying(res.status)) {
      signedOut = res.status === 401;
      retry = !signedOut;
      if (res.status === 429 || res.status === 503) retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));
      break;
    }
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    await store.put({ ...item, failure: { status: res.status, message: failureText(res.status, body?.error) } });
  }
  const rest = await store.all();
  return { sent, left: rest.filter((e) => !e.failure).length, failed: rest.filter((e) => e.failure).length, signedOut, retry, retryAfterMs };
}
