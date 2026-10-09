import { describe, expect, it } from "vitest";
import { describeQueued, enqueue, flushQueue, type QueuedEntry, type QueueStore } from "./offline-queue";

function memoryStore(): QueueStore & { items: QueuedEntry[] } {
  const items: QueuedEntry[] = [];
  return {
    items,
    all: async () => [...items],
    put: async (e) => {
      const at = items.findIndex((i) => i.id === e.id);
      if (at === -1) items.push(e);
      else items[at] = e;
    },
    remove: async (id) => void items.splice(items.findIndex((i) => i.id === id), 1),
  };
}

const meta = { report_code: null, barangay: "Linga", purok: null, household_head: "Bautista", lat: null, lng: null, gps_accuracy_m: null, photo_labels: ["Front"] } as never;
const blob = () => new Blob(["x"], { type: "image/jpeg" });
const reply = (status: number, body = "{}") => (async () => new Response(body, { status })) as unknown as typeof fetch;

describe("describeQueued", () => {
  it("counts photos and mentions the note", () => {
    expect(describeQueued({ photos: [blob(), blob(), blob()], note: blob() })).toBe("3 photos, note");
    expect(describeQueued({ photos: [blob()], note: null })).toBe("1 photo");
  });
});

describe("flushQueue", () => {
  it("sends everything and empties the queue", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    await enqueue(meta, [blob()], null, store);
    expect(await flushQueue(store, reply(201))).toMatchObject({ sent: 2, left: 0, failed: 0, signedOut: false, retry: false, retryAfterMs: null });
  });

  it("keeps entries when the hub is unreachable", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    const down = (async () => { throw new TypeError("network"); }) as unknown as typeof fetch;
    expect(await flushQueue(store, down)).toMatchObject({ sent: 0, left: 1, failed: 0, signedOut: false, retry: true });
  });

  it("keeps entries on a server error, a busy hub or a lost session", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    for (const status of [500, 503, 408, 425, 429]) expect(await flushQueue(store, reply(status))).toMatchObject({ left: 1, failed: 0 });
    expect(await flushQueue(store, reply(401))).toMatchObject({ left: 1, failed: 0, signedOut: true });
    expect(store.items[0].failure).toBeUndefined();
  });

  it("stops at a 401 without posting the entries behind it", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    await enqueue(meta, [blob()], null, store);
    let posts = 0;
    const lapsed = (async () => (posts++, new Response("{}", { status: 401 }))) as unknown as typeof fetch;
    expect(await flushQueue(store, lapsed)).toMatchObject({ sent: 0, left: 2, signedOut: true, retry: false });
    expect(posts).toBe(1);
    expect(store.items.every((e) => !e.failure)).toBe(true);
  });

  it("reads Retry-After on a 429 and a 503, and on nothing else", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    const withHeader = (status: number) => (async () => new Response("{}", { status, headers: { "retry-after": "30" } })) as unknown as typeof fetch;
    expect(await flushQueue(store, withHeader(429))).toMatchObject({ retry: true, retryAfterMs: 30_000 });
    expect(await flushQueue(store, withHeader(503))).toMatchObject({ retry: true, retryAfterMs: 30_000 });
    expect(await flushQueue(store, withHeader(500))).toMatchObject({ retry: true, retryAfterMs: null });
    expect(await flushQueue(store, reply(429))).toMatchObject({ retry: true, retryAfterMs: null });
  });

  it("gives each post a timeout so a hung one cannot hold the queue", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    let signal: AbortSignal | null | undefined;
    const spy = (async (_url: string, init?: RequestInit) => ((signal = init?.signal), new Response("{}", { status: 201 }))) as unknown as typeof fetch;
    await flushQueue(store, spy);
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps an entry the hub refuses for good and says why", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    expect(await flushQueue(store, reply(404, '{"error":"report_not_found"}'))).toMatchObject({ sent: 0, left: 0, failed: 1, signedOut: false, retry: false });
    expect(store.items).toHaveLength(1);
    expect(store.items[0].failure).toEqual({ status: 404, message: "That family report was not found." });
    expect(store.items[0].photos).toHaveLength(1);
  });

  it("keeps a 400 and a 413 with their errors", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    await enqueue(meta, [blob()], null, store);
    const statuses = [400, 413];
    const answer = (async () => new Response("{}", { status: statuses.shift() })) as unknown as typeof fetch;
    expect(await flushQueue(store, answer)).toMatchObject({ failed: 2 });
    expect(store.items.map((e) => e.failure?.status)).toEqual([400, 413]);
  });

  it("does not send a refused entry again, and sends the ones behind it", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    await flushQueue(store, reply(404));
    await enqueue(meta, [blob()], null, store);
    const calls: number[] = [];
    const ok = (async () => (calls.push(1), new Response("{}", { status: 201 }))) as unknown as typeof fetch;
    expect(await flushQueue(store, ok)).toMatchObject({ sent: 1, left: 0, failed: 1, signedOut: false });
    expect(calls).toHaveLength(1);
  });
});
