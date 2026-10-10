import { describe, expect, it, vi } from "vitest";
import type { NewReport } from "@/lib/contracts";
import { emptyDraft, toNewReport } from "./report-draft";
import { enqueue, flushQueue, householdLabel, hubReachable, memoryStore, readQueue, type QueuedReport } from "./offline-queue";

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
    const photo = new Blob(["a"], { type: "image/jpeg" });
    await enqueue(store, report, [{ kind: "photo", name: "photo.jpg", blob: photo }], new Date("2026-10-09T06:14:00Z"));
    const [item] = readQueue(await store.list());
    expect(item).toMatchObject({ state: "waiting", saved_at: "2026-10-09T06:14:00.000Z" });
    expect(item.attachments[0].blob).toBe(photo);
  });

  it("uses the client_id from the tap as the item id, and makes one when there is none", async () => {
    const store = memoryStore();
    const id = "3f6c2a1e-9b0d-4c55-8a7e-1d2f3a4b5c6d";
    const tapped = await enqueue(store, { ...report, client_id: id });
    expect(tapped.id).toBe(id);
    expect(tapped.report.client_id).toBe(id);
    const bare = await enqueue(store, report);
    expect(bare.report.client_id).toBe(bare.id);
  });

  it("labels a row like the design, without saying household twice", () => {
    expect(householdLabel("Dela Cruz")).toBe("Dela Cruz household");
    expect(householdLabel(" Lim Household ")).toBe("Lim Household");
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

  it("resends the same client_id after the hub answered 502, so the hub can recognize it", async () => {
    const store = memoryStore();
    const id = "3f6c2a1e-9b0d-4c55-8a7e-1d2f3a4b5c6d";
    await enqueue(store, { ...report, client_id: id });
    const bodies: string[] = [];
    const answers = [{ status: 502 }, { status: 201, body: { code: "K7M4" } }];
    const send = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/health")) return { ok: true, status: 200, json: async () => ({}) };
      bodies.push(init?.body as string);
      const a = answers.shift()!;
      return { ok: a.status < 300, status: a.status, json: async () => a.body ?? {} };
    }) as unknown as typeof fetch;

    expect(await flushQueue(store, send)).toMatchObject({ reachable: false, sent: [], left: 1 });
    expect((await flushQueue(store, send)).sent.map((s) => [s.id, s.code])).toEqual([[id, "K7M4"]]);
    expect(bodies.map((b) => JSON.parse(b).client_id)).toEqual([id, id]);
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
});

describe("flushQueue with a photo", () => {
  const photoId = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
  const withPhoto: NewReport = { ...report, photo_id: photoId };
  const picture = { kind: "photo" as const, name: "photo.jpeg", blob: new Blob(["jpg"], { type: "image/jpeg" }) };

  /** Answers health, the photo route and the report route, and records the order of the calls. */
  function photoHub(photo: Reply[], reports: Reply[]) {
    const photos = [...photo];
    const posts = [...reports];
    const calls: string[] = [];
    const bodies: NewReport[] = [];
    const forms: FormData[] = [];
    const send = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (url.startsWith("/api/health")) return { ok: true, status: 200, json: async () => ({}) };
      if (url === "/api/reports/photo") forms.push(init?.body as FormData);
      const next = url === "/api/reports/photo" ? photos.shift() : posts.shift();
      if (url === "/api/reports") bodies.push(JSON.parse(init?.body as string));
      const r = next ?? { status: 500 };
      if (r === "throw") throw new TypeError("Failed to fetch");
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body ?? {} };
    });
    return { send: send as unknown as typeof fetch, calls, bodies, forms };
  }
  const stored: Reply = { status: 201, body: { photo_id: photoId } };

  it("keeps the photo as a photo attachment and the photo_id on the report", async () => {
    const store = memoryStore();
    await enqueue(store, withPhoto, [picture]);
    const [item] = readQueue(await store.list());
    expect(item.report.photo_id).toBe(photoId);
    expect(item.attachments).toEqual([picture]);
  });

  it("uploads the photo before the report, under the photo_id the report carries", async () => {
    const store = memoryStore();
    await enqueue(store, withPhoto, [picture]);
    const h = photoHub([stored], [created("K7M4")]);
    const result = await flushQueue(store, h.send);
    expect(h.calls).toEqual(["/api/health", "/api/reports/photo", "/api/reports"]);
    expect(h.forms[0].get("photo_id")).toBe(photoId);
    expect(h.bodies[0].photo_id).toBe(photoId);
    expect(result).toMatchObject({ sent: [expect.objectContaining({ code: "K7M4" })], left: 0 });
    expect(await store.list()).toEqual([]);
  });

  it("keeps the photo until the report is accepted, and sends it again on each try", async () => {
    const store = memoryStore();
    await enqueue(store, withPhoto, [picture]);
    const h = photoHub([stored, stored], [{ status: 503 }, created("K7M4")]);
    await flushQueue(store, h.send);
    const [waiting] = await store.list();
    expect([waiting.state, waiting.attachments.map((a) => a.kind), waiting.report.photo_id]).toEqual(["waiting", ["photo"], photoId]);
    const result = await flushQueue(store, h.send);
    expect(h.calls.filter((c) => c === "/api/reports/photo")).toHaveLength(2);
    expect(h.bodies.map((b) => b.photo_id)).toEqual([photoId, photoId]);
    expect(result.sent.map((s) => s.code)).toEqual(["K7M4"]);
    expect(await store.list()).toEqual([]);
  });

  it("keeps the photo on a report the hub refuses", async () => {
    const store = memoryStore();
    await enqueue(store, withPhoto, [picture]);
    const h = photoHub([stored], [{ status: 400, body: { error: "bad_report" } }]);
    expect(await flushQueue(store, h.send)).toMatchObject({ refused: 1, left: 1, sent: [] });
    const [refused] = await store.list();
    expect(refused.state).toBe("refused");
    expect(refused.report.photo_id).toBe(photoId);
    expect(refused.attachments).toEqual([picture]);
  });

  it("sends the report without a photo_id when the hub answers but refuses the photo, and keeps nothing else back", async () => {
    const store = memoryStore();
    await enqueue(store, withPhoto, [picture]);
    const h = photoHub([{ status: 400, body: { error: "photo_type_not_allowed" } }], [created("K7M4")]);
    const result = await flushQueue(store, h.send);
    expect(h.bodies[0].photo_id).toBeNull();
    expect(result).toMatchObject({ sent: [expect.objectContaining({ code: "K7M4" })], left: 0 });
  });

  it("stops and keeps the report and its photo when the hub goes away during the upload", async () => {
    const store = memoryStore();
    await enqueue(store, withPhoto, [picture], new Date("2026-10-09T06:00:00Z"));
    await enqueue(store, report, [], new Date("2026-10-09T06:05:00Z"));
    const h = photoHub(["throw"], [created("K7M4")]);
    expect(await flushQueue(store, h.send)).toMatchObject({ reachable: false, sent: [], left: 2 });
    expect(h.calls).toEqual(["/api/health", "/api/reports/photo"]);
    const [first] = await store.list();
    expect(first.attachments).toEqual([picture]);
  });

  it("sends a report with no photo without calling the photo route", async () => {
    const store = memoryStore();
    await enqueue(store, report);
    const h = photoHub([], [created("K7M4")]);
    await flushQueue(store, h.send);
    expect(h.calls).toEqual(["/api/health", "/api/reports"]);
    expect(h.bodies[0].photo_id).toBeNull();
  });

  it("still reads an item queued before photos existed, whose report has no photo_id", () => {
    const old: Record<string, unknown> = { ...report };
    delete old.photo_id;
    const item = { id: "old", report: old, attachments: [], saved_at: "2026-10-09T06:00:00.000Z", state: "waiting" };
    const [read] = readQueue([item]);
    expect(read.id).toBe("old");
    expect(read.report.photo_id).toBeNull();
  });
});
