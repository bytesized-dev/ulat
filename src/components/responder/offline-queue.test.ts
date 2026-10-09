import { describe, expect, it } from "vitest";
import { describeQueued, enqueue, flushQueue, type QueuedEntry, type QueueStore } from "./offline-queue";

function memoryStore(): QueueStore & { items: QueuedEntry[] } {
  const items: QueuedEntry[] = [];
  return {
    items,
    all: async () => [...items],
    put: async (e) => void items.push(e),
    remove: async (id) => void items.splice(items.findIndex((i) => i.id === id), 1),
  };
}

const meta = { report_code: null, barangay: "Linga", purok: null, household_head: "Bautista", lat: null, lng: null, gps_accuracy_m: null, photo_labels: ["Front"] } as never;
const blob = () => new Blob(["x"], { type: "image/jpeg" });
const reply = (status: number) => (async () => new Response("{}", { status })) as unknown as typeof fetch;

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
    expect(await flushQueue(store, reply(201))).toEqual({ sent: 2, left: 0 });
  });

  it("keeps entries when the hub is unreachable", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    const down = (async () => { throw new TypeError("network"); }) as unknown as typeof fetch;
    expect(await flushQueue(store, down)).toEqual({ sent: 0, left: 1 });
  });

  it("keeps entries on a server error or a lost session", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    expect((await flushQueue(store, reply(500))).left).toBe(1);
    expect((await flushQueue(store, reply(401))).left).toBe(1);
  });

  it("drops an entry the hub refuses for good", async () => {
    const store = memoryStore();
    await enqueue(meta, [blob()], null, store);
    expect(await flushQueue(store, reply(400))).toEqual({ sent: 0, left: 0 });
  });
});
