import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeQueued,
  enqueue,
  flushQueue,
  SEND_TIMEOUT_BASE_MS,
  SEND_TIMEOUT_CAP_MS,
  SEND_TIMEOUT_PER_MB_MS,
  sendTimeoutMs,
  type QueuedEntry,
  type QueueStore,
} from "./offline-queue";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

const clientIdOf = (init?: RequestInit) => JSON.parse(String((init?.body as FormData).get("meta"))).client_id as string;
const timeout = () => new DOMException("The operation timed out.", "TimeoutError");
const big = (mb: number) => new Blob([new Uint8Array(mb * 1_000_000)], { type: "image/jpeg" });

afterEach(() => vi.restoreAllMocks());

describe("client id", () => {
  it("is made when an entry is queued without one, and kept when it has one", async () => {
    const store = memoryStore();
    const made = await enqueue(meta, [blob()], null, store);
    expect(made.meta.client_id).toMatch(UUID);
    const given = "3f6c2a1e-9b0d-4c55-8a7e-1d2f3a4b5c6d";
    const kept = await enqueue({ ...(meta as object), client_id: given } as never, [blob()], null, store);
    expect(kept.meta.client_id).toBe(given);
  });

  it("queues on a page with no crypto.randomUUID, as over plain HTTP", async () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    try {
      const entry = await enqueue(meta, [blob()], null, memoryStore());
      expect(entry.id).toMatch(UUID);
      expect(entry.meta.client_id).toMatch(UUID);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("is the same on every try, so a resend after a lost reply is the hub's duplicate to catch", async () => {
    const store = memoryStore();
    const queued = await enqueue(meta, [blob()], null, store);
    const seen: string[] = [];
    const lost = (async (_url: string, init?: RequestInit) => (seen.push(clientIdOf(init)), Promise.reject(new TypeError("network")))) as unknown as typeof fetch;
    const ok = (async (_url: string, init?: RequestInit) => (seen.push(clientIdOf(init)), new Response("{}", { status: 200 }))) as unknown as typeof fetch;
    await flushQueue(store, lost);
    await flushQueue(store, lost);
    await flushQueue(store, ok);
    expect(seen).toEqual([queued.meta.client_id, queued.meta.client_id, queued.meta.client_id]);
  });

  it("is given to an entry saved before ids existed, and stored before the first send", async () => {
    const store = memoryStore();
    store.items.push({ id: "old", saved_at: "2026-10-01T00:00:00.000Z", meta, photos: [blob()], note: null });
    let stored: string | undefined;
    let posted: string | undefined;
    const spy = (async (_url: string, init?: RequestInit) => {
      stored = store.items[0].meta.client_id;
      posted = clientIdOf(init);
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    expect(await flushQueue(store, spy)).toMatchObject({ sent: 1, left: 0 });
    expect(posted).toMatch(UUID);
    expect(stored).toBe(posted);
  });

  it("uses the row id of an old entry, so two tabs without a Web Lock send it under one id", async () => {
    const rowId = "4b8f1c2e-77a0-4d3b-9c51-0e6a2f9d8b13";
    const posted: string[] = [];
    const ok = (async (_url: string, init?: RequestInit) => (posted.push(clientIdOf(init)), new Response("{}", { status: 201 }))) as unknown as typeof fetch;
    const tabs = [memoryStore(), memoryStore()];
    for (const store of tabs) store.items.push({ id: rowId, saved_at: "2026-10-01T00:00:00.000Z", meta, photos: [blob()], note: null });
    await Promise.all(tabs.map((store) => flushQueue(store, ok)));
    expect(posted).toEqual([rowId, rowId]);
  });

  it("keeps the id it gave an old entry when the first send is lost", async () => {
    const store = memoryStore();
    store.items.push({ id: "old", saved_at: "2026-10-01T00:00:00.000Z", meta, photos: [blob()], note: null });
    const ids: string[] = [];
    const lost = (async (_url: string, init?: RequestInit) => (ids.push(clientIdOf(init)), Promise.reject(new TypeError("network")))) as unknown as typeof fetch;
    await flushQueue(store, lost);
    await flushQueue(store, lost);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
  });

  it("does not post an old entry whose new id could not be saved", async () => {
    const store = memoryStore();
    store.items.push({ id: "old", saved_at: "2026-10-01T00:00:00.000Z", meta, photos: [blob()], note: null });
    store.put = async () => {
      throw new Error("quota");
    };
    let posts = 0;
    const spy = (async () => (posts++, new Response("{}", { status: 201 }))) as unknown as typeof fetch;
    expect(await flushQueue(store, spy)).toMatchObject({ sent: 0, left: 1, retry: true });
    expect(posts).toBe(0);
  });
});

describe("hub answers to a repeated client id", () => {
  it("counts a 200 as sent, like a 201, and takes the entry off the queue", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    expect(await flushQueue(store, reply(200, '{"id":"e1","number":7,"status":"draft"}'))).toMatchObject({ sent: 1, left: 0, failed: 0, retry: false });
    expect(store.items).toHaveLength(0);
  });

  it("keeps a 409 client_id_taken with its error until it is dismissed, and does not send it again", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    expect(await flushQueue(store, reply(409, '{"error":"client_id_taken"}'))).toMatchObject({ sent: 0, left: 0, failed: 1, retry: false, signedOut: false });
    expect(store.items).toHaveLength(1);
    expect(store.items[0].failure).toEqual({ status: 409, message: "Another responder already used this entry's ID. Dismiss it and take the entry again." });
    let posts = 0;
    const spy = (async () => (posts++, new Response("{}", { status: 201 }))) as unknown as typeof fetch;
    await flushQueue(store, spy);
    expect(posts).toBe(0);
  });
});

describe("send timeout", () => {
  it("grows with the payload and stops at the cap", () => {
    expect(sendTimeoutMs(0)).toBe(SEND_TIMEOUT_BASE_MS);
    expect(sendTimeoutMs(1_000_000)).toBe(SEND_TIMEOUT_BASE_MS + SEND_TIMEOUT_PER_MB_MS);
    expect(sendTimeoutMs(30_000_000)).toBeGreaterThan(sendTimeoutMs(1_000_000));
    expect(sendTimeoutMs(30_000_000)).toBe(SEND_TIMEOUT_BASE_MS + 30 * SEND_TIMEOUT_PER_MB_MS);
    expect(sendTimeoutMs(10_000_000_000)).toBe(SEND_TIMEOUT_CAP_MS);
  });

  it("is set per entry from its photos and note", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    await enqueue(meta, [big(20), big(5)], big(1), store);
    const spy = vi.spyOn(AbortSignal, "timeout");
    await flushQueue(store, reply(201));
    expect(spy.mock.calls.map(([ms]) => ms)).toEqual([sendTimeoutMs(1), sendTimeoutMs(26_000_000)]);
    expect(spy.mock.calls[1][0]).toBeGreaterThan(spy.mock.calls[0][0]);
  });

  it("moves on to the next entry when one times out, and asks for a retry", async () => {
    const store = memoryStore();
    await enqueue(meta, [big(20)], null, store);
    await enqueue(meta, [blob()], null, store);
    const bySize = (async (_url: string, init?: RequestInit) => {
      if (((init?.body as FormData).getAll("photos")[0] as File).size > 1000) throw timeout();
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    expect(await flushQueue(store, bySize)).toMatchObject({ sent: 1, left: 1, failed: 0, retry: true, signedOut: false });
    expect(store.items[0].failure).toBeUndefined();
  });

  it("still stops the run on a plain network failure", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    await enqueue(meta, [blob()], null, store);
    let posts = 0;
    const down = (async () => (posts++, Promise.reject(new TypeError("network")))) as unknown as typeof fetch;
    expect(await flushQueue(store, down)).toMatchObject({ sent: 0, left: 2, retry: true });
    expect(posts).toBe(1);
  });

  it("sends an entry that timed out last on the next run, so it cannot hold the others up again", async () => {
    const store = memoryStore();
    const slow = await enqueue(meta, [big(20)], null, store);
    const stalled = new Set<string>();
    const order: string[] = [];
    const stall = (async (_url: string, init?: RequestInit) => {
      order.push(((init?.body as FormData).getAll("photos")[0] as File).size > 1000 ? "large" : "small");
      if (order.at(-1) === "large") throw timeout();
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    await flushQueue(store, stall, stalled);
    expect(stalled.has(slow.id)).toBe(true);
    await enqueue(meta, [blob()], null, store);
    order.length = 0;
    await flushQueue(store, stall, stalled);
    expect(order).toEqual(["small", "large"]);
  });

  it("forgets stalled ids for entries that left the queue", async () => {
    const store = memoryStore();
    const gone = await enqueue(meta, [big(1)], null, store);
    const stalled = new Set<string>([gone.id]);
    await store.remove(gone.id);
    const kept = await enqueue(meta, [big(1)], null, store);
    stalled.add(kept.id);
    await flushQueue(store, (async () => Promise.reject(timeout())) as unknown as typeof fetch, stalled);
    expect([...stalled]).toEqual([kept.id]);
  });

  it("keeps the same client id when a timed out entry is sent again", async () => {
    const store = memoryStore();
    const queued = await enqueue(meta, [big(20)], null, store);
    const seen: string[] = [];
    const stall = (async (_url: string, init?: RequestInit) => (seen.push(clientIdOf(init)), Promise.reject(timeout()))) as unknown as typeof fetch;
    const stalled = new Set<string>();
    await flushQueue(store, stall, stalled);
    await flushQueue(store, stall, stalled);
    expect(seen).toEqual([queued.meta.client_id, queued.meta.client_id]);
  });
});
