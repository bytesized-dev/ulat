"use client";

import { useSyncExternalStore } from "react";
import { browserStore, flushQueue, QUEUE_EVENT, type QueuedEntry } from "./offline-queue";

/** How often a phone with waiting entries asks the hub if it is back. */
export const POLL_MS = 5000;

type SyncState = {
  /** Null until the queue has been read once. */
  items: QueuedEntry[] | null;
  inRange: boolean;
  busy: boolean;
  /** The hub said the session ended, so the waiting entries need a new sign in. */
  signedOut: boolean;
};

const SERVER_STATE: SyncState = { items: null, inRange: false, busy: false, signedOut: false };

// One queue state for every /r page. It lives outside React so the layout can
// send the queue from any page, and the Queue screen only reads it.
let state: SyncState = SERVER_STATE;
const listeners = new Set<() => void>();

function update(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

async function hubAnswers(): Promise<boolean> {
  try {
    return (await fetch("/api/health", { cache: "no-store" })).ok;
  } catch {
    return false;
  }
}

async function refresh() {
  update({ items: await browserStore.all().catch(() => []) });
}

/**
 * One send at a time across every tab and every page load. A hard navigation can
 * leave the old page and the new one both holding the same entry, and each would
 * post it. Browsers only offer the lock on a secure origin, so over plain HTTP
 * on the local network the send runs without it.
 */
function exclusively<T>(work: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request("ulat-responder-queue", work) : work();
}

let running = false;

/** Reads the queue and, when the hub answers, sends what waits. */
async function check() {
  if (running) return;
  running = true;
  try {
    await refresh();
    const inRange = await hubAnswers();
    update({ inRange });
    if (inRange && state.items?.some((item) => !item.failure)) {
      update({ busy: true });
      const result = await exclusively(() => flushQueue());
      update({ signedOut: result.signedOut });
      await refresh();
    }
  } finally {
    running = false;
    update({ busy: false });
  }
}

/** Reads the queue again without sending, for a change a screen made itself, such as a dismissal. */
export function refreshQueue(): Promise<void> {
  return refresh();
}

/** Tells the layout an entry was just saved, so it tries to send without waiting for the next poll. */
export function announceQueueChange(): void {
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

/** Runs from the /r layout. Entries go out from whatever page the responder is on. */
export function startQueueSync(): () => void {
  const run = () => void check();
  const first = setTimeout(run, 0);
  // The health check runs while entries wait or the Queue screen is open, never for an idle page.
  const timer = setInterval(() => {
    if (listeners.size > 0 || state.items?.some((item) => !item.failure)) run();
    else void refresh();
  }, POLL_MS);
  window.addEventListener("online", run);
  window.addEventListener(QUEUE_EVENT, run);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
    window.removeEventListener("online", run);
    window.removeEventListener(QUEUE_EVENT, run);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The queue as the last check read it, for the Queue screen. */
export function useQueueSync() {
  return {
    ...useSyncExternalStore(subscribe, () => state, () => SERVER_STATE),
    retry: check,
  };
}
