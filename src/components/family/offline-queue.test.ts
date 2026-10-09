import { describe, expect, it, vi } from "vitest";
import type { NewReport } from "@/lib/contracts";
import { emptyDraft, toNewReport } from "./report-draft";
import { enqueue, flushQueue, hubReachable, memoryStore, readQueue, type QueuedReport } from "./offline-queue";

const draft = { ...emptyDraft(), household_head: "Dela Cruz", barangay: "Poblacion", people: 4 };
const parsed = toNewReport(draft);
if (!parsed.success) throw new Error("fixture draft is not a valid report");
const report: NewReport = parsed.data;

type Reply = { status: number; body?: unknown } | "throw";

/** A fetch that answers /api/health and /api/reports from the given replies. */
function hub(health: Reply, reports: Reply[]) {
  const queue = [...reports];
  const calls: string[] = [];
  const reply = (r: Reply) => {
    if (r === "throw") throw new TypeError("Failed to fetch");
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body ?? {} };
  };
  const send = vi.fn(async (url: string) => {
    calls.push(url);
    return url.startsWith("/api/health") ? reply(health) : reply(queue.shift() ?? { status: 500 });
  });
  return { send: send as unknown as typeof fetch, calls };
}

const created = (code: string): Reply => ({ status: 201, body: { code } });

describe("queue", () => {
  it("keeps what was queued, with its attachments", async () => {
    const store = memoryStore();
    const audio = new Blob(["a"], { type: "audio/webm" });
    await enqueue(store, report, [{ kind: "audio", name: "note.webm", blob: audio }], new Date("2026-10-09T06:14:00Z"));
    const [item] = readQueue(await store.list());
    expect(item).toMatchObject({ state: "waiting", saved_at: "2026-10-09T06:14:00.000Z" });
    expect(item.attachments[0].blob).toBe(audio);
  });

  it("drops stored items that are not valid reports and lists the rest oldest first", () => {
    const late: QueuedReport = { id: "b", report, attachments: [], saved_at: "2026-10-09T07:00:00.000Z", state: "waiting" };
    const early: QueuedReport = { ...late, id: "a", saved_at: "2026-10-09T06:00:00.000Z" };
    const items = readQueue([late, { id: "x", report: { nope: true } }, "junk", early]);
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("hubReachable", () => {
  it("is true when health answers, false when it fails or throws", async () => {
    expect(await hubReachable(hub({ status: 200 }, []).send)).toBe(true);
    expect(await hubReachable(hub({ status: 500 }, []).send)).toBe(false);
    expect(await hubReachable(hub("throw", []).send)).toBe(false);
  });
});

describe("flushQueue", () => {
  it("sends nothing and keeps the queue while health does not answer", async () => {
    const store = memoryStore();
    await enqueue(store, report);
    const h = hub("throw", []);
    const result = await flushQueue(store, h.send);
    expect(result).toEqual({ reachable: false, sent: [], refused: 0, left: 1 });
    expect(h.calls).toEqual(["/api/health"]);
  });

  it("sends the waiting reports oldest first and empties the queue", async () => {
    const store = memoryStore();
    const first = await enqueue(store, report, [], new Date("2026-10-09T06:00:00Z"));
    const second = await enqueue(store, report, [], new Date("2026-10-09T06:05:00Z"));
    const h = hub({ status: 200 }, [created("K7M4"), created("R8T3")]);
    const result = await flushQueue(store, h.send);
    expect(result.sent.map((s) => [s.id, s.code])).toEqual([
      [first.id, "K7M4"],
      [second.id, "R8T3"],
    ]);
    expect(result.left).toBe(0);
    expect(await store.list()).toEqual([]);
  });

  it("stops when the hub goes away part way and keeps the rest waiting", async () => {
    const store = memoryStore();
    await enqueue(store, report, [], new Date("2026-10-09T06:00:00Z"));
    await enqueue(store, report, [], new Date("2026-10-09T06:05:00Z"));
    const h = hub({ status: 200 }, [created("K7M4"), "throw"]);
    const result = await flushQueue(store, h.send);
    expect(result).toMatchObject({ reachable: false, left: 1 });
    expect(result.sent).toHaveLength(1);
    expect((await store.list())[0].state).toBe("waiting");
  });

  it("marks a report the hub refuses and still sends the next one", async () => {
    const store = memoryStore();
    await enqueue(store, report, [], new Date("2026-10-09T06:00:00Z"));
    await enqueue(store, report, [], new Date("2026-10-09T06:05:00Z"));
    const h = hub({ status: 200 }, [{ status: 400, body: { error: "bad_report" } }, created("R8T3")]);
    const result = await flushQueue(store, h.send);
    expect(result).toMatchObject({ reachable: true, refused: 1, left: 1 });
    expect(result.sent.map((s) => s.code)).toEqual(["R8T3"]);
    expect((await store.list())[0].state).toBe("refused");
  });

  it("leaves a report waiting when the hub is busy, and does not ping health for a refused-only queue", async () => {
    const store = memoryStore();
    await enqueue(store, report);
    const busy = await flushQueue(store, hub({ status: 200 }, [{ status: 500 }]).send);
    expect(busy).toMatchObject({ reachable: true, sent: [], left: 1 });
    expect((await store.list())[0].state).toBe("waiting");

    const only = memoryStore();
    await only.put({ id: "r", report, attachments: [], saved_at: "2026-10-09T06:00:00.000Z", state: "refused" });
    const h = hub("throw", []);
    expect(await flushQueue(only, h.send)).toEqual({ reachable: true, sent: [], refused: 1, left: 1 });
    expect(h.calls).toEqual([]);
  });

  it("hands each sent report's files to upload, and does not resend if the upload fails", async () => {
    const store = memoryStore();
    await enqueue(store, report, [{ kind: "photo", name: "house.jpg", blob: new Blob(["p"]) }]);
    const upload = vi.fn(async () => {
      throw new Error("no upload endpoint");
    });
    const result = await flushQueue(store, hub({ status: 200 }, [created("K7M4")]).send, upload);
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ attachments: [expect.objectContaining({ name: "house.jpg" })] }), "K7M4");
    expect(result).toMatchObject({ left: 0 });
  });
});
