import { describe, expect, it, vi } from "vitest";
import { ReportStatusView } from "@/lib/contracts";
import { changesReport, fetchStatus, normalizeCode, placeOf, resultOf, timelineItems } from "./status-view";

function view(overrides: Partial<ReportStatusView> = {}): ReportStatusView {
  return ReportStatusView.parse({
    code: "K7P4",
    household_head: "Dela Cruz household",
    barangay: "San Isidro",
    purok: "Purok 3",
    urgent: true,
    steps: [
      { step: "received", at: "2026-10-09T06:14:00.000Z" },
      { step: "on_the_way", at: null },
      { step: "visited", at: null },
      { step: "confirmed", at: null },
    ],
    result: null,
    confirmed_by: null,
    ...overrides,
  });
}

const steps = (...at: (string | null)[]) =>
  ["received", "on_the_way", "visited", "confirmed"].map((step, i) => ({ step, at: at[i] ?? null }));

const T = ["2026-10-09T06:14:00.000Z", "2026-10-09T06:20:00.000Z", "2026-10-09T06:46:00.000Z", "2026-10-09T06:48:00.000Z"];

function reply(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

describe("normalizeCode", () => {
  it("upper-cases and drops spaces", () => {
    expect(normalizeCode(" k7 p4 ")).toBe("K7P4");
  });
});

describe("timelineItems", () => {
  it("waits for a visit after the report is received", () => {
    expect(timelineItems(view())).toEqual([
      { label: "Received", time: "2:14 PM", state: "done" },
      { label: "Waiting for a visit", time: undefined, state: "current" },
      { label: "Visited", time: undefined, state: "upcoming" },
      { label: "Result", time: undefined, state: "upcoming" },
    ]);
  });

  it("says on the way once the responder has left, and Visited is next", () => {
    const items = timelineItems(view({ steps: steps(T[0], T[1]) as never }));
    expect(items.map((i) => [i.label, i.state])).toEqual([
      ["Received", "done"],
      ["On the way", "done"],
      ["Visited", "current"],
      ["Result", "upcoming"],
    ]);
  });

  it("counts on the way as done when the responder visited without marking it", () => {
    const items = timelineItems(view({ steps: steps(T[0], null, T[2], T[3]) as never, result: "total" }));
    expect(items.map((i) => [i.label, i.time, i.state])).toEqual([
      ["Received", "2:14 PM", "done"],
      ["On the way", undefined, "done"],
      ["Visited", "2:46 PM", "done"],
      ["Confirmed", "2:48 PM", "done"],
    ]);
  });

  it("is all done and says Confirmed when the entry is confirmed", () => {
    const items = timelineItems(view({ steps: steps(...T) as never, result: "total" }));
    expect(items.map((i) => [i.label, i.time, i.state])).toEqual([
      ["Received", "2:14 PM", "done"],
      ["On the way", "2:20 PM", "done"],
      ["Visited", "2:46 PM", "done"],
      ["Confirmed", "2:48 PM", "done"],
    ]);
  });
});

describe("resultOf", () => {
  it("is null before a responder confirms", () => {
    expect(resultOf(view())).toBeNull();
  });

  it("names the damage with a dot tone and who confirmed it", () => {
    expect(resultOf(view({ result: "total", confirmed_by: "Mae Santos" }))).toEqual({ label: "Totally damaged", tone: "danger", confirmedBy: "Mae Santos" });
    expect(resultOf(view({ result: "partial" }))?.tone).toBe("warning");
    expect(resultOf(view({ result: "none" }))?.label).toBe("No damage");
  });
});

describe("placeOf", () => {
  it("joins barangay and purok, and copes with no purok", () => {
    expect(placeOf(view())).toBe("San Isidro, Purok 3");
    expect(placeOf(view({ purok: null }))).toBe("San Isidro");
  });
});

describe("changesReport", () => {
  const code = "K7P4";
  it("reacts to this code's report.updated and entry.confirmed", () => {
    expect(changesReport({ type: "report.updated", code, status: "visited" }, code)).toBe(true);
    expect(changesReport({ type: "entry.confirmed", entry_id: crypto.randomUUID(), report_code: code }, code)).toBe(true);
  });

  it("ignores other codes, other events and no event", () => {
    expect(changesReport({ type: "report.updated", code: "ZZZZ", status: "visited" }, code)).toBe(false);
    expect(changesReport({ type: "entry.confirmed", entry_id: crypto.randomUUID(), report_code: null }, code)).toBe(false);
    expect(changesReport({ type: "update.posted", update_id: crypto.randomUUID() }, code)).toBe(false);
    expect(changesReport(null, code)).toBe(false);
  });
});

describe("fetchStatus", () => {
  it("asks the hub for the normalized code and returns the view", async () => {
    const send = reply(200, view());
    const result = await fetchStatus(" k7p4 ", send);
    expect(result).toEqual({ ok: true, view: view() });
    expect(send.mock.calls[0][0]).toBe("/api/reports/K7P4");
  });

  it("does not call the hub for a code that cannot exist", async () => {
    const send = reply(200, view());
    const result = await fetchStatus("K7", send);
    expect(result.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("says so when the code is not found", async () => {
    const result = await fetchStatus("K7P4", reply(404, { error: "not_found" }));
    expect(result).toEqual({ ok: false, message: "We could not find that code. Check it and try again." });
  });

  it("drops fields the contract does not list", async () => {
    const result = await fetchStatus("K7P4", reply(200, { ...view(), injuries: "broken arm", lat: 1 }));
    expect(result.ok && Object.keys(result.view).sort()).toEqual(Object.keys(view()).sort());
  });

  it("treats a bad answer or a dropped connection as the hub being unreachable", async () => {
    const bad = await fetchStatus("K7P4", reply(200, { code: "K7P4" }));
    const down = await fetchStatus("K7P4", vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("fail"))));
    expect(bad).toEqual({ ok: false, message: "Could not reach the hub. Check the Wi-Fi and try again." });
    expect(down).toEqual(bad);
  });
});
