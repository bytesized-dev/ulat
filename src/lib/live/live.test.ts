import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/events/route";
import {
  SESSION_COOKIE,
  getSessionSecret,
  signSession,
  type ResponderSession,
  type StaffSession,
} from "@/lib/auth/session";
import type { HubEvent } from "@/lib/contracts";
import { openStreamCount, publish, subscribe } from "./bus";
import { canSee, viewerFromRequest, type Viewer } from "./scope";

// Sessions are checked against the stored secret and the responders table.
// Both are faked here so the tests never touch data/ulat.db.
const active = new Set<string>();
vi.mock("@/lib/auth/settings", () => ({ readOrCreateSetting: () => "a".repeat(64) }));
vi.mock("@/lib/auth/responders", () => ({ isActiveResponder: (id: string) => active.has(id) }));

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

const hour = 60 * 60 * 1000;
const staffSession: StaffSession = { role: "staff", exp: Date.now() + hour };
const responderSession: ResponderSession = {
  role: "responder",
  responder_id: "r-active",
  name: "Mae Santos",
  exp: Date.now() + hour,
};

function withCookies(url: string, cookies: Record<string, string>, signal?: AbortSignal) {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return new Request(url, { headers: { cookie }, signal });
}

const staffToken = async (session = staffSession) => signSession(session, await getSessionSecret());
const responderToken = async (session = responderSession) => signSession(session, await getSessionSecret());

beforeEach(() => {
  active.clear();
  active.add(responderSession.responder_id);
});

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

describe("viewerFromRequest with a session", () => {
  const url = "http://hub/api/events";

  it("gives a staff session the staff view, even with a code", async () => {
    const request = withCookies(`${url}?code=A2S3`, { [SESSION_COOKIE.staff]: await staffToken() });
    expect(await viewerFromRequest(request)).toEqual({ ok: true, viewer: { role: "staff" } });
  });

  it("gives an active responder session the responder view", async () => {
    const request = withCookies(url, { [SESSION_COOKIE.responder]: await responderToken() });
    expect(await viewerFromRequest(request)).toEqual({ ok: true, viewer: { role: "responder" } });
  });

  it("checks staff before responder", async () => {
    const request = withCookies(url, {
      [SESSION_COOKIE.responder]: await responderToken(),
      [SESSION_COOKIE.staff]: await staffToken(),
    });
    expect(await viewerFromRequest(request)).toEqual({ ok: true, viewer: { role: "staff" } });
  });

  it("gives a switched-off responder the family view", async () => {
    active.delete(responderSession.responder_id);
    const request = withCookies(`${url}?code=A2S3`, { [SESSION_COOKIE.responder]: await responderToken() });
    expect(await viewerFromRequest(request)).toEqual({ ok: true, viewer: { role: "family", code: "A2S3" } });
  });

  it("gives an expired cookie the family view", async () => {
    const expired = { ...staffSession, exp: Date.now() - 1 };
    const request = withCookies(url, { [SESSION_COOKIE.staff]: await staffToken(expired) });
    expect(await viewerFromRequest(request)).toEqual({ ok: true, viewer: { role: "family", code: null } });
  });

  it("gives a forged cookie the family view", async () => {
    const forged = signSession(staffSession, Buffer.from("b".repeat(64), "hex"));
    const [body] = (await staffToken()).split(".");
    const request = withCookies(url, {
      [SESSION_COOKIE.staff]: forged,
      [SESSION_COOKIE.responder]: `${body}.not-the-signature`,
    });
    expect(await viewerFromRequest(request)).toEqual({ ok: true, viewer: { role: "family", code: null } });
  });

  it("does not take a staff token in the responder cookie", async () => {
    const request = withCookies(url, { [SESSION_COOKIE.responder]: await staffToken() });
    expect(await viewerFromRequest(request)).toEqual({ ok: true, viewer: { role: "family", code: null } });
  });

  it("still rejects a malformed code when the cookie is not valid", async () => {
    const request = withCookies(`${url}?code=bad`, { [SESSION_COOKIE.staff]: "forged" });
    expect((await viewerFromRequest(request)).ok).toBe(false);
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

  it("sends a staff stream every event and does not count it as a phone", async () => {
    const controller = new AbortController();
    const request = withCookies(
      "http://hub/api/events",
      { [SESSION_COOKIE.staff]: await staffToken() },
      controller.signal,
    );
    const before = openStreamCount();
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(openStreamCount()).toBe(before);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    expect(decoder.decode((await reader.read()).value)).toBe("retry: 3000\n\n");

    publish(events.needsReview);
    expect(decoder.decode((await reader.read()).value)).toBe(`data: ${JSON.stringify(events.needsReview)}\n\n`);
    publish(events.hubStatus);
    expect(decoder.decode((await reader.read()).value)).toBe(`data: ${JSON.stringify(events.hubStatus)}\n\n`);

    controller.abort();
    expect((await reader.read()).done).toBe(true);
  });

  it("sends an active responder stream every event and counts it", async () => {
    const controller = new AbortController();
    const request = withCookies(
      "http://hub/api/events",
      { [SESSION_COOKIE.responder]: await responderToken() },
      controller.signal,
    );
    const response = await GET(request);
    expect(openStreamCount()).toBe(1);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    await reader.read();
    publish(events.drafted);
    expect(decoder.decode((await reader.read()).value)).toBe(`data: ${JSON.stringify(events.drafted)}\n\n`);

    controller.abort();
    expect(openStreamCount()).toBe(0);
  });
});
