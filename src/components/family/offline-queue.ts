import { z } from "zod";
import { NewReport } from "@/lib/contracts";
import { postReport } from "./send-report";

// Reports a family agreed to send while the hub could not be reached. They wait
// here, on the phone, with any audio and photos, and go out once /api/health
// answers. This file is the queue's rules. The IndexedDB store is in queue-db.ts
// and the screen is saved-on-phone.tsx.

export const HEALTH_URL = "/api/health";
/** How long the phone waits for the hub before it calls it unreachable. */
export const HEALTH_TIMEOUT_MS = 4000;
/** Page-level signal that the queue changed, so the screen can read it again. */
export const QUEUE_EVENT = "ulat:queue-changed";

export type QueuedAttachment = { kind: "audio" | "photo"; name: string; blob: Blob };

export type QueuedReport = {
  id: string;
  report: NewReport;
  attachments: QueuedAttachment[];
  /** ISO timestamp in UTC. */
  saved_at: string;
  /** Waiting goes out when the hub is back. Refused means the hub rejected it, so retrying cannot help. */
  state: "waiting" | "refused";
};

export interface QueueStore {
  list(): Promise<QueuedReport[]>;
  put(item: QueuedReport): Promise<void>;
  remove(id: string): Promise<void>;
}

const Stored = z.object({
  id: z.string().min(1),
  report: NewReport,
  attachments: z.array(z.object({ kind: z.enum(["audio", "photo"]), name: z.string(), blob: z.instanceof(Blob) })),
  saved_at: z.iso.datetime(),
  state: z.enum(["waiting", "refused"]),
});

/** The valid items in what a store returned, oldest first. Anything else is dropped, never sent. */
export function readQueue(raw: unknown[]): QueuedReport[] {
  return raw
    .flatMap((item) => {
      const parsed = Stored.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    })
    .sort((a, b) => a.saved_at.localeCompare(b.saved_at));
}

/** A store that lives for this page load. For tests and for browsers that block IndexedDB. */
export function memoryStore(): QueueStore {
  const items = new Map<string, QueuedReport>();
  return {
    list: async () => [...items.values()],
    put: async (item) => void items.set(item.id, item),
    remove: async (id) => void items.delete(id),
  };
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Saves a report to wait for the hub. Returns the queued item. */
export async function enqueue(
  store: QueueStore,
  report: NewReport,
  attachments: QueuedAttachment[] = [],
  at: Date = new Date(),
): Promise<QueuedReport> {
  const item: QueuedReport = { id: newId(), report, attachments, saved_at: at.toISOString(), state: "waiting" };
  await store.put(item);
  return item;
}

/** True when the hub answers its health check in time. Never throws. */
export async function hubReachable(send: typeof fetch = fetch, timeoutMs: number = HEALTH_TIMEOUT_MS): Promise<boolean> {
  try {
    const res = await send(HEALTH_URL, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}

export type SentItem = { id: string; code: string; saved_at: string };
export type FlushResult = { reachable: boolean; sent: SentItem[]; refused: number; left: number };

/**
 * Sends the waiting reports, oldest first, when the hub answers. A sent report
 * leaves the queue. One the hub refuses stays, marked refused, and the rest go
 * on. If the hub goes away part way, the rest stay waiting for the next try.
 */
export async function flushQueue(
  store: QueueStore,
  send: typeof fetch = fetch,
  /** Sends an item's audio and photos once its report has a code. */
  upload?: (item: QueuedReport, code: string) => Promise<void>,
): Promise<FlushResult> {
  const items = readQueue(await store.list());
  const waiting = items.filter((item) => item.state === "waiting");
  if (waiting.length === 0) return { reachable: true, sent: [], refused: items.length, left: items.length };
  if (!(await hubReachable(send))) return { reachable: false, sent: [], refused: items.length - waiting.length, left: items.length };

  const sent: SentItem[] = [];
  let reachable = true;
  for (const item of waiting) {
    const result = await postReport(item.report, send);
    if (result.ok) {
      try {
        await upload?.(item, result.code);
      } catch {
        // The report is counted already. A file that fails to upload must not send it twice.
      }
      await store.remove(item.id);
      sent.push({ id: item.id, code: result.code, saved_at: item.saved_at });
    } else if (result.unreachable) {
      reachable = false;
      break;
    } else if (!result.retry) {
      await store.put({ ...item, state: "refused" });
    }
    // Busy or rate limited: leave it waiting and try the next one.
  }
  const after = readQueue(await store.list());
  return { reachable, sent, refused: after.filter((item) => item.state === "refused").length, left: after.length };
}
