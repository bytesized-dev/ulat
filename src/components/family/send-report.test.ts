import { describe, expect, it, vi } from "vitest";
import { NewReport } from "@/lib/contracts";
import { emptyDraft, type ReportDraft } from "./report-draft";
import { canSend, sendReport, summarizeDraft, uploadPhoto, uploadVoice } from "./send-report";

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

describe("a spoken report", () => {
  const voiceId = "7d5c1e2a-3b4f-4a6d-9c8e-0f1a2b3c4d5e";
  const spoken: ReportDraft = { ...draft, voice_id: voiceId, spoken: true };
  const recording = new Blob(["opus"], { type: "audio/webm;codecs=opus" });

  /** A hub that answers the voice upload and the report in turn. */
  function hub(voice: Response | "throw", report: Response | "throw" = Response.json({ code: "K7M4" }, { status: 201 })) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const send = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const answer = url === "/api/reports/voice" ? voice : report;
      if (answer === "throw") throw new TypeError("Failed to fetch");
      return answer.clone();
    }) as unknown as typeof fetch;
    return { send, calls };
  }
  const stored = () => Response.json({ voice_id: voiceId }, { status: 201 });
  const reportBody = (call: { init?: RequestInit }) => JSON.parse(call.init?.body as string);

  it("uploads the recording as multipart under its voice_id", async () => {
    const h = hub(stored());
    expect(await uploadVoice(recording, voiceId, h.send)).toEqual({ ok: true });
    const form = h.calls[0].init?.body as FormData;
    expect(form.get("voice_id")).toBe(voiceId);
    const file = form.get("audio") as File;
    expect([file.name, file.type]).toEqual(["note.webm", "audio/webm;codecs=opus"]);
  });

  it("treats a refusal, a wrong answer and a dead hub as three different things", async () => {
    expect(await uploadVoice(recording, voiceId, hub(Response.json({ error: "too_large" }, { status: 413 })).send)).toEqual({ ok: false, unreachable: false });
    expect(await uploadVoice(recording, voiceId, hub(Response.json({ voice_id: crypto.randomUUID() }, { status: 201 })).send)).toEqual({ ok: false, unreachable: false });
    expect(await uploadVoice(recording, voiceId, hub(new Response(null, { status: 502 })).send)).toEqual({ ok: false, unreachable: true });
    expect(await uploadVoice(recording, voiceId, hub("throw").send)).toEqual({ ok: false, unreachable: true });
  });

  it("uploads the audio first and posts the report with the voice_id", async () => {
    const h = hub(stored());
    expect(await sendReport(spoken, h.send, undefined, recording)).toEqual({ ok: true, code: "K7M4" });
    expect(h.calls.map((c) => c.url)).toEqual(["/api/reports/voice", "/api/reports"]);
    expect(reportBody(h.calls[1]).voice_id).toBe(voiceId);
  });

  it("sends a typed report without audio and never calls the voice route", async () => {
    const h = hub(stored());
    await sendReport({ ...draft, voice_id: null }, h.send, undefined, null);
    expect(h.calls.map((c) => c.url)).toEqual(["/api/reports"]);
    expect(reportBody(h.calls[0]).voice_id).toBeNull();
  });

  it("drops the voice_id when the recording is gone, so the hub is not asked for audio it never got", async () => {
    const h = hub(stored());
    await sendReport(spoken, h.send, undefined, null);
    expect(h.calls.map((c) => c.url)).toEqual(["/api/reports"]);
    expect(reportBody(h.calls[0]).voice_id).toBeNull();
  });

  it("still sends the report, without audio, when the hub refuses the recording", async () => {
    const h = hub(Response.json({ error: "audio_type_not_allowed" }, { status: 400 }));
    expect(await sendReport(spoken, h.send, undefined, recording)).toEqual({ ok: true, code: "K7M4" });
    expect(h.calls.map((c) => c.url)).toEqual(["/api/reports/voice", "/api/reports"]);
    expect(reportBody(h.calls[1]).voice_id).toBeNull();
  });

  it("posts nothing when the hub cannot be reached for the recording, so the caller can queue both", async () => {
    const h = hub("throw");
    expect(await sendReport(spoken, h.send, undefined, recording)).toMatchObject({ ok: false, unreachable: true, retry: true });
    expect(h.calls.map((c) => c.url)).toEqual(["/api/reports/voice"]);
  });
});

describe("a report with a photo", () => {
  const photoId = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
  const photo = { blob: new Blob(["jpg"], { type: "image/jpeg" }), id: photoId };

  /** A hub that answers the photo upload and the report in turn. */
  function hub(upload: Response | "throw", report: Response | "throw" = Response.json({ code: "K7M4" }, { status: 201 })) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const send = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const answer = url === "/api/reports/photo" ? upload : report;
      if (answer === "throw") throw new TypeError("Failed to fetch");
      return answer.clone();
    }) as unknown as typeof fetch;
    return { send, calls };
  }
  const stored = () => Response.json({ photo_id: photoId }, { status: 201 });
  const reportBody = (call: { init?: RequestInit }) => JSON.parse(call.init?.body as string);

  it("uploads the photo as multipart under its photo_id", async () => {
    const h = hub(stored());
    expect(await uploadPhoto(photo.blob, photoId, h.send)).toEqual({ ok: true });
    const form = h.calls[0].init?.body as FormData;
    expect(form.get("photo_id")).toBe(photoId);
    expect((form.get("photo") as File).type).toBe("image/jpeg");
    expect((form.get("photo") as File).name).toBe("photo.jpeg");
  });

  it("treats a refusal, a wrong answer and a dead hub as three different things", async () => {
    expect(await uploadPhoto(photo.blob, photoId, hub(Response.json({ error: "too_large" }, { status: 413 })).send)).toEqual({ ok: false, unreachable: false });
    expect(await uploadPhoto(photo.blob, photoId, hub(Response.json({ photo_id: crypto.randomUUID() }, { status: 201 })).send)).toEqual({ ok: false, unreachable: false });
    expect(await uploadPhoto(photo.blob, photoId, hub(new Response(null, { status: 502 })).send)).toEqual({ ok: false, unreachable: true });
    expect(await uploadPhoto(photo.blob, photoId, hub("throw").send)).toEqual({ ok: false, unreachable: true });
  });

  it("uploads the photo first and posts the report with the photo_id", async () => {
    const h = hub(stored());
    expect(await sendReport(draft, h.send, undefined, null, photo)).toEqual({ ok: true, code: "K7M4" });
    expect(h.calls.map((c) => c.url)).toEqual(["/api/reports/photo", "/api/reports"]);
    expect(reportBody(h.calls[1]).photo_id).toBe(photoId);
  });

  it("sends a report with no photo without calling the photo route", async () => {
    const h = hub(stored());
    await sendReport(draft, h.send);
    expect(h.calls.map((c) => c.url)).toEqual(["/api/reports"]);
    expect(reportBody(h.calls[0]).photo_id).toBeNull();
  });

  it("still sends the report, without the photo_id, when the hub refuses the photo", async () => {
    const h = hub(Response.json({ error: "photo_type_not_allowed" }, { status: 400 }));
    expect(await sendReport(draft, h.send, undefined, null, photo)).toEqual({ ok: true, code: "K7M4" });
    expect(h.calls.map((c) => c.url)).toEqual(["/api/reports/photo", "/api/reports"]);
    expect(reportBody(h.calls[1]).photo_id).toBeNull();
  });

  it("posts nothing when the hub cannot be reached for the photo, so the caller can queue both", async () => {
    const h = hub("throw");
    expect(await sendReport(draft, h.send, undefined, null, photo)).toMatchObject({ ok: false, unreachable: true, retry: true });
    expect(h.calls.map((c) => c.url)).toEqual(["/api/reports/photo"]);
  });

  it("sends the same photo_id on each try, so a resend never makes a second file", async () => {
    const h = hub(stored());
    await sendReport(draft, h.send, "3f6c2a1e-9b0d-4c55-8a7e-1d2f3a4b5c6d", null, photo);
    await sendReport(draft, h.send, "3f6c2a1e-9b0d-4c55-8a7e-1d2f3a4b5c6d", null, photo);
    const forms = h.calls.filter((c) => c.url === "/api/reports/photo").map((c) => (c.init?.body as FormData).get("photo_id"));
    expect(forms).toEqual([photoId, photoId]);
  });

  it("uploads the audio, then the photo, then the report", async () => {
    const voiceId = "7d5c1e2a-3b4f-4a6d-9c8e-0f1a2b3c4d5e";
    const calls: string[] = [];
    const send = (async (url: string) => {
      calls.push(url);
      if (url === "/api/reports/voice") return Response.json({ voice_id: voiceId }, { status: 201 });
      if (url === "/api/reports/photo") return stored();
      return Response.json({ code: "K7M4" }, { status: 201 });
    }) as unknown as typeof fetch;
    const spoken: ReportDraft = { ...draft, voice_id: voiceId, spoken: true };
    await sendReport(spoken, send, undefined, new Blob(["opus"], { type: "audio/webm" }), photo);
    expect(calls).toEqual(["/api/reports/voice", "/api/reports/photo", "/api/reports"]);
  });
});
