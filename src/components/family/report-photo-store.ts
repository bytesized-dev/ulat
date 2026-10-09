// Where the report's photo is kept while the family fills in the report. It sits
// in IndexedDB, not in sessionStorage, because a photo is too big for
// sessionStorage and must survive a reload, Back and Continue. It has its own
// database, apart from the offline queue's, so neither needs a version bump.
// A browser that blocks IndexedDB (some private modes) keeps the photo in
// memory for this page load.

const DB_NAME = "ulat-draft";
const STORE = "photo";
const KEY = "photo";

export interface PhotoStore {
  get(): Promise<Blob | null>;
  set(photo: Blob): Promise<void>;
  clear(): Promise<void>;
}

/** A store that lives for this page load. For tests and for browsers that block IndexedDB. */
export function memoryPhotoStore(): PhotoStore {
  let kept: Blob | null = null;
  return {
    get: async () => kept,
    set: async (photo) => void (kept = photo),
    clear: async () => void (kept = null),
  };
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
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

function indexedDbPhotoStore(): PhotoStore {
  return {
    get: () => run("readonly", (s) => s.get(KEY) as IDBRequest<unknown>).then((value) => (value instanceof Blob ? value : null)),
    set: (photo) => run("readwrite", (s) => s.put(photo, KEY)).then(() => undefined),
    clear: () => run("readwrite", (s) => s.delete(KEY)).then(() => undefined),
  };
}

let shared: PhotoStore | null = null;

/** The phone's photo store. Falls back to memory when IndexedDB is missing or refuses to open. */
export function photoStore(): PhotoStore {
  if (shared) return shared;
  if (typeof indexedDB === "undefined") return (shared = memoryPhotoStore());
  const db = indexedDbPhotoStore();
  const fallback = memoryPhotoStore();
  let broken = false;
  const guard =
    <A extends unknown[], R>(call: (s: PhotoStore) => (...args: A) => Promise<R>) =>
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
    get: guard((s) => () => s.get()),
    set: guard((s) => (photo: Blob) => s.set(photo)),
    clear: guard((s) => () => s.clear()),
  };
  return shared;
}

// What every screen reads. The photo is loaded from the store once, then this
// copy is the truth, so the row updates the moment a photo is added or removed
// even if the browser refuses to save it.

export type PhotoSnapshot = { photo: Blob | null; ready: boolean };

export const NO_PHOTO: PhotoSnapshot = { photo: null, ready: false };

let snapshot = NO_PHOTO;
let loading = false;
const listeners = new Set<() => void>();

function publish(next: PhotoSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function getPhotoSnapshot(): PhotoSnapshot {
  return snapshot;
}

export function subscribePhoto(listener: () => void): () => void {
  listeners.add(listener);
  void loadReportPhoto();
  return () => {
    listeners.delete(listener);
  };
}

/** Reads the kept photo once. A photo added before the read finishes wins. */
export async function loadReportPhoto(): Promise<void> {
  if (snapshot.ready || loading) return;
  loading = true;
  try {
    const photo = await photoStore().get();
    if (!snapshot.ready) publish({ photo, ready: true });
  } catch {
    if (!snapshot.ready) publish({ photo: null, ready: true });
  } finally {
    loading = false;
  }
}

/** Keeps this photo as the report's one photo, in place of any before it. */
export async function keepReportPhoto(photo: Blob): Promise<void> {
  publish({ photo, ready: true });
  try {
    await photoStore().set(photo);
  } catch {
    // The photo stays on screen for this page load even when it cannot be saved.
  }
}

/** Drops the report's photo. Also what clearing the draft does. */
export async function clearReportPhoto(): Promise<void> {
  publish({ photo: null, ready: true });
  try {
    await photoStore().clear();
  } catch {
    // Nothing to clear.
  }
}
