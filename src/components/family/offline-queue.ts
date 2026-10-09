import { z } from "zod";
import { NewReport } from "@/lib/contracts";
import { newClientId } from "@/lib/client-id";
import { postReport, uploadPhoto, uploadVoice } from "./send-report";

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

/** The row title, "Dela Cruz household" as the design shows it. A name that already says household is left alone. */
export function householdLabel(head: string): string {
  const name = head.trim();
  return /household$/i.test(name) ? name : `${name} household`;
}

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

/**
 * Saves a report to wait for the hub. Returns the queued item. The item's id is
 * the report's client_id, made when the family tapped Send, so the hub treats a
 * resend after a lost reply as the same report.
 */
export async function enqueue(
  store: QueueStore,
  report: NewReport,
  attachments: QueuedAttachment[] = [],
  at: Date = new Date(),
): Promise<QueuedReport> {
  const id = report.client_id ?? newClientId();
  const item: QueuedReport = { id, report: { ...report, client_id: id }, attachments, saved_at: at.toISOString(), state: "waiting" };
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
 *
 * A report with a recording sends the recording first, under the voice_id the
 * report carries. The queue keeps its copy of the audio until the hub accepts
 * the report. A retry sends the audio again, which costs the hub nothing, since
 * the same voice_id never makes a second file. A report the hub refuses keeps
 * its audio too, so the family can fix it and send it with its recording. If the
 * hub answers but refuses the recording, the report goes without it: the report
 * matters more than its audio.
 *
 * A photo goes the same way, under the photo_id the report carries, and the
 * queue keeps it on the same terms as the audio.
 */
export async function flushQueue(
  store: QueueStore,
  send: typeof fetch = fetch,
): Promise<FlushResult> {
  const items = readQueue(await store.list());
  const waiting = items.filter((item) => item.state === "waiting");
  if (waiting.length === 0) return { reachable: true, sent: [], refused: items.length, left: items.length };
  if (!(await hubReachable(send))) return { reachable: false, sent: [], refused: items.length - waiting.length, left: items.length };

  const sent: SentItem[] = [];
  let reachable = true;
  for (const item of waiting) {
    let report = item.report;
    const audio = item.attachments.find((a) => a.kind === "audio");
    if (audio && report.voice_id) {
      const voice = await uploadVoice(audio.blob, report.voice_id, send);
      if (!voice.ok && voice.unreachable) {
        reachable = false;
        break;
      }
      // The queue keeps the audio. The hub deletes a recording no report has
      // taken within an hour, so only an accepted report can let go of it.
      if (!voice.ok) report = { ...report, voice_id: null };
    }
    const photo = item.attachments.find((a) => a.kind === "photo");
    if (photo && report.photo_id) {
      const sentPhoto = await uploadPhoto(photo.blob, report.photo_id, send);
      if (!sentPhoto.ok && sentPhoto.unreachable) {
        reachable = false;
        break;
      }
      // Kept, like the audio, until the hub accepts the report.
      if (!sentPhoto.ok) report = { ...report, photo_id: null };
    }
    const result = await postReport(report, send);
    if (result.ok) {
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
