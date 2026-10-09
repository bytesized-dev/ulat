import { describe, expect, it, vi } from "vitest";
import { NewReport } from "@/lib/contracts";
import { emptyDraft, type ReportDraft } from "./report-draft";
import { canSend, sendReport, summarizeDraft } from "./send-report";

const draft: ReportDraft = {
  ...emptyDraft(),
  household_head: "Dela Cruz household",
  barangay: "San Isidro",
  purok: "Purok 3",
  people: 5,
  hurt: 1,
  needs: ["water", "tarp"],
};

const reply = (status: number, body: unknown) => vi.fn(async () => Response.json(body, { status }));

describe("summarizeDraft", () => {
  it("lists the household, the place, the numbers and the needs as the design shows them", () => {
    expect(summarizeDraft(draft)).toEqual({
      household: "Dela Cruz household",
      place: "San Isidro, Purok 3",
      pills: [{ label: "5 people" }, { label: "1 hurt", dot: "danger" }, { label: "Water" }, { label: "Tarp" }],
    });
  });

  it("leaves out hurt and missing at zero, and a purok that was not given", () => {
    const summary = summarizeDraft({ ...draft, people: 1, hurt: 0, needs: [], purok: " " });
    expect(summary.place).toBe("San Isidro");
    expect(summary.pills).toEqual([{ label: "1 person" }]);
    expect(summarizeDraft({ ...draft, missing: 2 }).pills).toContainEqual({ label: "2 missing", dot: "danger" });
  });
});

describe("sendReport", () => {
  it("posts the draft as a NewReport with consent true and returns the code", async () => {
    const send = reply(201, { code: "K7P4" });
    const result = await sendReport(draft, send as unknown as typeof fetch);

    expect(result).toEqual({ ok: true, code: "K7P4" });
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/reports");
    expect(init.method).toBe("POST");
    const sent = NewReport.parse(JSON.parse(init.body as string));
    expect(sent).toMatchObject({ consent: true, household_head: "Dela Cruz household", barangay: "San Isidro", people: 5, hurt: 1 });
  });

  it("sends the client_id it was given, and none when it was not given one", async () => {
    const id = "3f6c2a1e-9b0d-4c55-8a7e-1d2f3a4b5c6d";
    const withId = reply(201, { code: "K7P4" });
    await sendReport(draft, withId as unknown as typeof fetch, id);
    const [, init] = withId.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).client_id).toBe(id);

    const without = reply(201, { code: "K7P4" });
    await sendReport(draft, without as unknown as typeof fetch);
    const [, plain] = without.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(plain.body as string)).not.toHaveProperty("client_id");
  });

  it("does not post a draft that is missing what the hub needs", async () => {
    const send = reply(201, { code: "K7P4" });
    const result = await sendReport({ ...draft, household_head: "" }, send as unknown as typeof fetch);

    expect(result).toMatchObject({ ok: false, retry: false });
    expect(send).not.toHaveBeenCalled();
    expect(canSend({ ...draft, household_head: "" })).toBe(false);
    expect(canSend(draft)).toBe(true);
  });

  it("says to try again when the hub is busy, down or not answering with a code", async () => {
    for (const status of [500, 503]) {
      expect(await sendReport(draft, reply(status, { error: "x" }) as unknown as typeof fetch)).toMatchObject({ ok: false, retry: true });
    }
    expect(await sendReport(draft, reply(201, { nope: true }) as unknown as typeof fetch)).toMatchObject({ ok: false, retry: true });
    expect(await sendReport(draft, reply(429, { error: "rate_limited" }) as unknown as typeof fetch)).toMatchObject({ ok: false, retry: true });
  });

  it("says the report needs a fix when the hub refuses it", async () => {
    for (const status of [400, 413]) {
      expect(await sendReport(draft, reply(status, { error: "bad_report" }) as unknown as typeof fetch)).toMatchObject({ ok: false, retry: false });
    }
  });

  it("says the hub could not be reached when the request throws", async () => {
    const send = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await sendReport(draft, send as unknown as typeof fetch);
    expect(result).toEqual({ ok: false, message: "Could not reach the hub. Check the Wi-Fi and try again.", retry: true, unreachable: true });
    expect(await sendReport(draft, reply(502, {}) as unknown as typeof fetch)).toMatchObject({ ok: false, unreachable: true });
  });

  it("leaves the draft as it was after a failure", async () => {
    const before = structuredClone(draft);
    await sendReport(draft, reply(500, {}) as unknown as typeof fetch);
    expect(draft).toEqual(before);
  });
});
