import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/events/route";
import type { HubEvent } from "@/lib/contracts";
import { openStreamCount, publish, subscribe } from "./bus";
import { canSee, viewerFromRequest, type Viewer } from "./scope";

const id = () => crypto.randomUUID();
const status = {
  internet: false,
  phones: 0,
  battery_percent: null,
  charging: null,
  model_loaded: true,
  storage_free_gb: null,
  simulation: true,
};

const events: Record<string, HubEvent> = {
  createdA: { type: "report.created", code: "A2S3", urgent: false },
  createdB: { type: "report.created", code: "B3N6", urgent: true },
  updatedA: { type: "report.updated", code: "A2S3", status: "assigned" },
  updatedB: { type: "report.updated", code: "B3N6", status: "waiting" },
  confirmedA: { type: "entry.confirmed", entry_id: id(), report_code: "A2S3" },
  confirmedB: { type: "entry.confirmed", entry_id: id(), report_code: "B3N6" },
  confirmedNoCode: { type: "entry.confirmed", entry_id: id(), report_code: null },
  drafted: { type: "entry.drafted", entry_id: id() },
  needsReview: { type: "entry.needs_review", entry_id: id() },
  checkedIn: { type: "safe.checked_in", id: id() },
  hubStatus: { type: "hub.status", status },
  update: { type: "update.posted", update_id: id() },
  place: { type: "place.saved", place_id: id() },
};

const visibleTo = (viewer: Viewer) =>
  Object.entries(events)
    .filter(([, event]) => canSee(viewer, event))
    .map(([name]) => name);

describe("canSee", () => {
  it("gives a family its own code, updates and places, and nothing else", () => {
    expect(visibleTo({ role: "family", code: "A2S3" })).toEqual([
      "createdA",
      "updatedA",
      "confirmedA",
      "update",
      "place",
    ]);
  });

  it("gives a family with no code only updates and places", () => {
    expect(visibleTo({ role: "family", code: null })).toEqual(["update", "place"]);
  });

  it("gives responders and staff everything", () => {
    expect(visibleTo({ role: "responder" })).toHaveLength(Object.keys(events).length);
    expect(visibleTo({ role: "staff" })).toHaveLength(Object.keys(events).length);
  });
});

describe("viewerFromRequest", () => {
  it("reads a valid code, accepts no code, and rejects a malformed one", async () => {
    expect(await viewerFromRequest(new Request("http://hub/api/events?code=A2S3"))).toEqual({
      ok: true,
      viewer: { role: "family", code: "A2S3" },
    });
    expect(await viewerFromRequest(new Request("http://hub/api/events"))).toEqual({
      ok: true,
      viewer: { role: "family", code: null },
    });
    expect((await viewerFromRequest(new Request("http://hub/api/events?code=bad"))).ok).toBe(false);
  });
});

describe("bus", () => {
  it("rejects an event that does not match the contract", () => {
    expect(() => publish({ type: "report.created", code: "nope", urgent: false })).toThrow();
    expect(() => publish({ type: "nothing" } as unknown as HubEvent)).toThrow();
  });

  it("counts open streams and leaves staff out", () => {
    const before = openStreamCount();
    const offFamily = subscribe({ role: "family", code: null }, () => {});
    const offStaff = subscribe({ role: "staff" }, () => {});
    expect(openStreamCount()).toBe(before + 1);
    offFamily();
    offStaff();
    expect(openStreamCount()).toBe(before);
  });

  it("keeps delivering when one subscriber throws", () => {
    const seen: HubEvent[] = [];
    const offBad = subscribe({ role: "staff" }, () => {
      throw new Error("closed stream");
    });
    const offGood = subscribe({ role: "staff" }, (event) => seen.push(event));
    publish(events.update);
    offBad();
    offGood();
    expect(seen).toEqual([events.update]);
  });
});

describe("GET /api/events", () => {
  it("answers 400 for a malformed code", async () => {
    const response = await GET(new Request("http://hub/api/events?code=bad"));
    expect(response.status).toBe(400);
    expect(openStreamCount()).toBe(0);
  });

  it("streams events the viewer may see and closes cleanly on abort", async () => {
    const controller = new AbortController();
    const response = await GET(new Request("http://hub/api/events?code=A2S3", { signal: controller.signal }));
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(openStreamCount()).toBe(1);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    expect(decoder.decode((await reader.read()).value)).toBe("retry: 3000\n\n");

    publish(events.createdB);
    publish(events.drafted);
    publish(events.updatedA);
    const chunk = decoder.decode((await reader.read()).value);
    expect(chunk).toBe(`data: ${JSON.stringify(events.updatedA)}\n\n`);

    controller.abort();
    expect(openStreamCount()).toBe(0);
    expect((await reader.read()).done).toBe(true);
  });
});
