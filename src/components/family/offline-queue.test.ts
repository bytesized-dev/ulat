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
    const audio = new Blob(["a"], { type: "audio/webm" });
    await enqueue(store, report, [{ kind: "audio", name: "note.webm", blob: audio }], new Date("2026-10-09T06:14:00Z"));
    const [item] = readQueue(await store.list());
    expect(item).toMatchObject({ state: "waiting", saved_at: "2026-10-09T06:14:00.000Z" });
    expect(item.attachments[0].blob).toBe(audio);
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

describe("flushQueue with a voice note", () => {
  const voiceId = "7d5c1e2a-3b4f-4a6d-9c8e-0f1a2b3c4d5e";
  const spoken: NewReport = { ...report, voice_id: voiceId };
  const note = { kind: "audio" as const, name: "note.webm", blob: new Blob(["opus"], { type: "audio/webm" }) };

  /** Answers health, the voice route and the report route, and records the order of the calls. */
  function voiceHub(voice: Reply[], reports: Reply[]) {
    const voices = [...voice];
    const posts = [...reports];
    const calls: string[] = [];
    const bodies: NewReport[] = [];
    const send = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (url.startsWith("/api/health")) return { ok: true, status: 200, json: async () => ({}) };
      const next = url === "/api/reports/voice" ? voices.shift() : posts.shift();
      if (url === "/api/reports") bodies.push(JSON.parse(init?.body as string));
      const r = next ?? { status: 500 };
      if (r === "throw") throw new TypeError("Failed to fetch");
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body ?? {} };
    });
    return { send: send as unknown as typeof fetch, calls, bodies };
  }
  const stored: Reply = { status: 201, body: { voice_id: voiceId } };

  it("uploads the audio before the report and sends the voice_id", async () => {
    const store = memoryStore();
    await enqueue(store, spoken, [note]);
    const h = voiceHub([stored], [created("K7M4")]);
    const result = await flushQueue(store, h.send);
    expect(h.calls).toEqual(["/api/health", "/api/reports/voice", "/api/reports"]);
    expect(h.bodies[0].voice_id).toBe(voiceId);
    expect(result).toMatchObject({ sent: [expect.objectContaining({ code: "K7M4" })], left: 0 });
  });

  it("keeps the audio until the report is accepted, and sends it again on each try", async () => {
    const store = memoryStore();
    await enqueue(store, spoken, [note]);
    const h = voiceHub([stored, stored], [{ status: 503 }, created("K7M4")]);
    await flushQueue(store, h.send);
    // The hub deletes a recording no report has taken within an hour, so the queue holds on to its copy.
    const [waiting] = await store.list();
    expect([waiting.state, waiting.attachments.map((a) => a.kind), waiting.report.voice_id]).toEqual(["waiting", ["audio"], voiceId]);
    const result = await flushQueue(store, h.send);
    expect(h.calls.filter((c) => c === "/api/reports/voice")).toHaveLength(2);
    expect(h.bodies.map((b) => b.voice_id)).toEqual([voiceId, voiceId]);
    expect(result.sent.map((s) => s.code)).toEqual(["K7M4"]);
    expect(await store.list()).toEqual([]);
  });

  it("keeps the audio on a report the hub refuses, so the fix can send it", async () => {
    const store = memoryStore();
    await enqueue(store, spoken, [note]);
    const h = voiceHub([stored], [{ status: 400, body: { error: "bad_report" } }]);
    expect(await flushQueue(store, h.send)).toMatchObject({ refused: 1, left: 1, sent: [] });
    const [refused] = await store.list();
    expect(refused.state).toBe("refused");
    expect(refused.report.voice_id).toBe(voiceId);
    expect(refused.attachments).toEqual([note]);
  });

  it("stops and keeps the report and its audio when the hub goes away during the upload", async () => {
    const store = memoryStore();
    await enqueue(store, spoken, [note], new Date("2026-10-09T06:00:00Z"));
    await enqueue(store, report, [], new Date("2026-10-09T06:05:00Z"));
    const h = voiceHub(["throw"], [created("K7M4")]);
    const result = await flushQueue(store, h.send);
    expect(result).toMatchObject({ reachable: false, sent: [], left: 2 });
    expect(h.calls).toEqual(["/api/health", "/api/reports/voice"]);
    const [first] = await store.list();
    expect(first.attachments).toHaveLength(1);
  });

  it("sends the report without audio when the hub answers but refuses the recording", async () => {
    const store = memoryStore();
    await enqueue(store, spoken, [note]);
    const h = voiceHub([{ status: 413, body: { error: "too_large" } }], [created("K7M4")]);
    const result = await flushQueue(store, h.send);
    expect(h.bodies[0].voice_id).toBeNull();
    expect(result).toMatchObject({ sent: [expect.objectContaining({ code: "K7M4" })], left: 0 });
  });

  it("sends a typed report with no audio and never calls the voice route", async () => {
    const store = memoryStore();
    await enqueue(store, report);
    const h = voiceHub([], [created("K7M4")]);
    await flushQueue(store, h.send);
    expect(h.calls).toEqual(["/api/health", "/api/reports"]);
    expect(h.bodies[0].voice_id).toBeNull();
  });

  it("hands photos to upload but not the audio the queue already sent", async () => {
    const store = memoryStore();
    const photo = { kind: "photo" as const, name: "house.jpg", blob: new Blob(["p"]) };
    await enqueue(store, spoken, [note, photo]);
    const upload = vi.fn(async () => {});
    await flushQueue(store, voiceHub([stored], [created("K7M4")]).send, upload);
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ attachments: [photo] }), "K7M4");
  });
});

