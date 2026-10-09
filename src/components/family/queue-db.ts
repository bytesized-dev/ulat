import { memoryStore, type QueuedReport, type QueueStore } from "./offline-queue";

// The queue in IndexedDB, so a report and its audio and photos survive a closed
// tab or a dead battery. IndexedDB stores Blobs as they are. A browser that
// blocks it (some private modes) falls back to memory for this page load.

const DB_NAME = "ulat";
const STORE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

function indexedDbStore(): QueueStore {
  return {
    list: () => run("readonly", (s) => s.getAll() as IDBRequest<QueuedReport[]>),
    put: (item) => run("readwrite", (s) => s.put(item)).then(() => undefined),
    remove: (id) => run("readwrite", (s) => s.delete(id)).then(() => undefined),
  };
}

let shared: QueueStore | null = null;

/** The phone's queue. Falls back to memory when IndexedDB is missing or refuses to open. */
export function queueStore(): QueueStore {
  if (shared) return shared;
  if (typeof indexedDB === "undefined") return (shared = memoryStore());
  const db = indexedDbStore();
  const fallback = memoryStore();
  let broken = false;
  // Try IndexedDB first. Once it fails, the rest of this page load uses memory.
  const guard =
    <A extends unknown[], R>(call: (s: QueueStore) => (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      if (!broken) {
        try {
          return await call(db)(...args);
        } catch {
          broken = true;
        }
      }
      return call(fallback)(...args);
    };
  shared = {
    list: guard((s) => () => s.list()),
    put: guard((s) => (item: QueuedReport) => s.put(item)),
    remove: guard((s) => (id: string) => s.remove(id)),
  };
  return shared;
}
