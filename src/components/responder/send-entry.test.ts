import { describe, expect, it } from "vitest";
import { createClientIds, sendEntry, UNCLEAR_ANSWER, type ClientIds } from "./send-entry";

const house = { report_code: "K7P4", barangay: "Dapitan", purok: "Purok 2", household_head: "Maria Santos" };
const entry = { damage_class: "partial" as const, material: "mixed" as const, hazards: [], families: 1, people: 4, hurt: 0, missing: 0, needs: [] };
const photo = (name = "a.jpg") => new File(["x"], name, { type: "image/jpeg" });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A fetch that answers in order and records the client_id of each POST. */
function hub(...answers: (() => Response | Promise<Response>)[]) {
  const ids: string[] = [];
  const send = (async (_url: string, init?: RequestInit) => {
    ids.push(JSON.parse(String((init?.body as FormData).get("meta"))).client_id);
    return answers[ids.length - 1]();
  }) as unknown as typeof fetch;
  return { ids, send };
}
const tap = (ids: ClientIds, send: typeof fetch, over: Partial<Parameters<typeof sendEntry>[0]> = {}) =>
  sendEntry({ house, labels: ["Front"], gps: null, photos: [photo()], note: null, entry, ids, ...over }, send);

describe("createClientIds", () => {
  it("gives the same id until it is cleared, and a new one for another house", () => {
    const ids = createClientIds();
    const first = ids.get("K7P4");
    expect(first).toMatch(UUID);
    expect(ids.get("K7P4")).toBe(first);
    expect(ids.get("T3M9")).not.toBe(first);
    expect(ids.get("T3M9")).not.toBe(ids.get("K7P4"));
    const again = ids.get("K7P4");
    ids.clear();
    expect(ids.get("K7P4")).not.toBe(again);
  });
});

describe("sendEntry, the online path", () => {
  it("keeps one id when a 201 comes back with a body that cannot be read, then finds the entry on the retry", async () => {
    const { ids: seen, send } = hub(
      () => new Response("<html>cut off", { status: 201 }),
      () => new Response(JSON.stringify({ id: "e1", number: 7, status: "draft" }), { status: 200 }),
    );
    const ids = createClientIds();
    const first = await tap(ids, send);
    // A likely success: the screen must not offer a plain error that invites a fresh entry.
    expect(first).toEqual({ kind: "unclear" });
    expect(UNCLEAR_ANSWER).toMatch(/may already have this entry/);
    expect(await tap(ids, send)).toEqual({ kind: "saved", id: "e1" });
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[0]).toMatch(UUID);
  });

  it("keeps one id when a 502 comes back, then again on the retry", async () => {
    const { ids: seen, send } = hub(
      () => new Response("{}", { status: 502 }),
      () => new Response(JSON.stringify({ id: "e1" }), { status: 200 }),
    );
    const ids = createClientIds();
    expect(await tap(ids, send)).toEqual({ kind: "refused", message: "Could not send to the hub. Try again." });
    expect(await tap(ids, send)).toEqual({ kind: "saved", id: "e1" });
    expect(seen[1]).toBe(seen[0]);
  });

  it("keeps the id when the photos or the note change between taps", async () => {
    const { ids: seen, send } = hub(
      () => new Response("{}", { status: 502 }),
      () => new Response(JSON.stringify({ id: "e1" }), { status: 200 }),
    );
    const ids = createClientIds();
    await tap(ids, send);
    await tap(ids, send, { photos: [photo("b.jpg"), photo("c.jpg")], labels: ["Front", "Roof"], note: new Blob(["n"], { type: "audio/webm" }) });
    expect(seen[1]).toBe(seen[0]);
  });

  it("treats a 2xx with a readable body but no id as unclear", async () => {
    const { send } = hub(() => new Response("{}", { status: 201 }));
    expect(await tap(createClientIds(), send)).toEqual({ kind: "unclear" });
  });

  it("keeps the id when the hub never answers, and hands the same one to the queued copy", async () => {
    const { ids: seen, send } = hub(
      () => Promise.reject(new TypeError("network")),
      () => new Response(JSON.stringify({ id: "e1" }), { status: 201 }),
    );
    const ids = createClientIds();
    const lost = await tap(ids, send);
    if (lost.kind !== "unreachable") throw new Error(lost.kind);
    expect(lost.meta.client_id).toBe(seen[0]);
    await tap(ids, send);
    expect(seen[1]).toBe(seen[0]);
  });

  it("starts a new id once the entry is saved, and for a different house", async () => {
    const { ids: seen, send } = hub(
      () => new Response(JSON.stringify({ id: "e1" }), { status: 201 }),
      () => new Response(JSON.stringify({ id: "e2" }), { status: 201 }),
    );
    const ids = createClientIds();
    await tap(ids, send);
    await tap(ids, send, { house: { ...house, report_code: null } });
    expect(seen[1]).not.toBe(seen[0]);
  });

  it("counts a 200 like a 201", async () => {
    const { send } = hub(() => new Response(JSON.stringify({ id: "e1" }), { status: 200 }));
    expect(await tap(createClientIds(), send)).toEqual({ kind: "saved", id: "e1" });
  });

  it("does not post a house with no barangay", async () => {
    const { ids: seen, send } = hub(() => new Response("{}", { status: 201 }));
    expect(await tap(createClientIds(), send, { house: { ...house, barangay: "" } })).toEqual({ kind: "invalid" });
    expect(seen).toHaveLength(0);
  });
});
