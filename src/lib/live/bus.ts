import { HubEvent } from "@/lib/contracts";
import type { Viewer } from "./scope";

// In-process fan-out for the server-sent events stream. Route handlers call
// publish() after a write, and every open GET /api/events stream is told.
// This is not the audit trail in the events table, which is why the module is
// called live.

type Subscriber = { viewer: Viewer; send: (event: HubEvent) => void };

// The registry lives on globalThis, like the db handle in src/db/client.ts.
// Next reloads modules in dev and bundles each route separately, so a plain
// module-level Set would not be the same Set in /api/events and in the route
// that publishes.
const globalForLive = globalThis as unknown as { ulatLiveSubscribers?: Set<Subscriber> };
const subscribers: Set<Subscriber> = (globalForLive.ulatLiveSubscribers ??= new Set());

/** Throws if the event does not match the HubEvent contract. */
export function publish(event: HubEvent): void {
  const parsed = HubEvent.parse(event);
  for (const subscriber of [...subscribers]) {
    try {
      subscriber.send(parsed);
    } catch {
      // A broken stream must not stop the others from hearing the event.
    }
  }
}

/** Returns the function that closes the registration. */
export function subscribe(viewer: Viewer, send: (event: HubEvent) => void): () => void {
  const subscriber: Subscriber = { viewer, send };
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

/** Open streams for the phones number on the hub. Staff are the hub laptop, not a phone. */
export function openStreamCount(): number {
  let count = 0;
  for (const subscriber of subscribers) {
    if (subscriber.viewer.role !== "staff") count += 1;
  }
  return count;
}
