"use client";

import { useSyncExternalStore } from "react";
import { flushQueue, QUEUE_EVENT, readQueue, type QueuedReport, type SentItem } from "./offline-queue";
import { queueStore } from "./queue-db";
import { saveSentReport } from "./sent-report";

/** How often a phone with waiting reports asks the hub if it is back. */
export const RETRY_MS = 5000;

/** Tells the page the queue changed, so the saved screen reads it and tries to send. */
export function announceQueueChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
}

type QueueState = {
  items: QueuedReport[];
  /** False after the hub failed to answer, until it answers again. */
  reachable: boolean;
  busy: boolean;
  /** The newest report the queue sent, so the screen can move on. */
  sent: SentItem | null;
};

const SERVER_STATE: QueueState = { items: [], reachable: true, busy: false, sent: null };

// One queue state for the whole page. It is a store outside React so that
// reading it and the timers that drive it never set state from inside an effect.
let state: QueueState = SERVER_STATE;
const listeners = new Set<() => void>();

function update(patch: Partial<QueueState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

async function refresh() {
  try {
    update({ items: readQueue(await queueStore().list()) });
  } catch {
    update({ items: [] });
  }
}

let running = false;

/** Reads the queue and, when something waits, asks the hub to take it. */
async function retry() {
  if (running) return;
  running = true;
  update({ busy: true });
  try {
    const result = await flushQueue(queueStore());
    const last = result.sent.at(-1);
    if (last) saveSentReport(last.code);
    update({ reachable: result.reachable, ...(last ? { sent: last } : {}) });
  } catch {
    update({ reachable: false });
  } finally {
    running = false;
    update({ busy: false });
    await refresh();
  }
}

const hasWaiting = () => state.items.some((item) => item.state === "waiting");

/** Starts the timers with the first reader and stops them with the last. */
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const onChange = () => void refresh().then(retry);
    const onOnline = () => void retry();
    const timer = setInterval(() => {
      if (hasWaiting()) void retry();
    }, RETRY_MS);
    window.addEventListener(QUEUE_EVENT, onChange);
    window.addEventListener("online", onOnline);
    // Reports left from an earlier visit go out as soon as the page opens near the hub.
    void refresh().then(retry);
    stop = () => {
      clearInterval(timer);
      window.removeEventListener(QUEUE_EVENT, onChange);
      window.removeEventListener("online", onOnline);
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

let stop = () => {};

/** The phone's offline queue. A report that goes out is remembered like any sent report, so the family sees its code. */
export function useOfflineQueue() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  return { ...snapshot, waiting: snapshot.items.some((item) => item.state === "waiting"), retry };
}
