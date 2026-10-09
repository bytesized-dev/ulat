import { describe, expect, it } from "vitest";
import { AiVoiceExtract, NewReport, SafeCheckin } from "@/lib/contracts";
import {
  applyExtract,
  emptyHousehold,
  emptySafe,
  parseCount,
  saveCheckin,
  saveReport,
  toNewReport,
  toSafeCheckin,
  uncertainLabels,
  validateHousehold,
  validateSafe,
  type HouseholdForm,
} from "./desk-report";

const extract = (patch: Partial<AiVoiceExtract> = {}): AiVoiceExtract => ({
  language: "tl",
  transcript: "Apat kami, may nahulog na bubong",
  english: "There are four of us, part of the roof fell",
  household_head: "Pedro Santiago",
  people: 4,
  hurt: 0,
  missing: 0,
  what_happened: "Part of the roof fell in",
  needs: ["water", "tarp"],
  hazards: [],
  uncertain_fields: [],
  ...patch,
});

const filled: HouseholdForm = { name: " Pedro Santiago ", barangay: "Sinonoc", purok: "Purok 1", people: "4", hurt: "0", missing: "1", what: "Part of the roof fell in", needs: ["water", "food"] };

describe("parseCount", () => {
  it("takes whole numbers from 0 to 99 and nothing else", () => {
    expect(parseCount("0")).toBe(0);
    expect(parseCount(" 12 ")).toBe(12);
    for (const bad of ["", "100", "-1", "2.5", "four", "1e1"]) expect(parseCount(bad)).toBeNull();
  });
});

describe("applyExtract", () => {
  it("fills the form from the note", () => {
    expect(applyExtract(emptyHousehold(), extract())).toEqual({
      name: "Pedro Santiago",
      barangay: "",
      purok: "",
      people: "4",
      hurt: "0",
      missing: "0",
      what: "Part of the roof fell in",
      needs: ["water", "tarp"],
    });
  });

  it("keeps what staff typed for a field the note did not mention", () => {
    const next = applyExtract(filled, extract({ household_head: null, people: null, hurt: 2, missing: null, what_happened: null, needs: [] }));
    expect(next).toEqual({ ...filled, hurt: "2" });
  });

  it("lists the fields the model was unsure about in words", () => {
    expect(uncertainLabels(extract({ uncertain_fields: ["people", "what_happened"] }))).toEqual(["people", "what happened"]);
  });
});

describe("validateHousehold", () => {
  it("passes a filled form", () => {
    expect(validateHousehold(filled)).toEqual({});
  });

  it("names every field that is wrong", () => {
    expect(validateHousehold({ ...emptyHousehold(), hurt: "x" })).toEqual({
      name: "Enter a name",
      barangay: "Pick a barangay",
      people: "Enter 0 to 99",
      hurt: "Enter 0 to 99",
    });
  });
});

describe("toNewReport", () => {
  it("builds a desk report the contract accepts", () => {
    const report = toNewReport(filled, null);
    expect(NewReport.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({ source: "desk", household_head: "Pedro Santiago", people: 4, missing: 1, purok: "Purok 1", voice_id: null, transcript: null, language: null, consent: true });
  });

  it("carries the voice note and leaves empty text as null", () => {
    const report = toNewReport({ ...filled, purok: " ", what: "" }, { transcript: "Apat kami", english: "Four of us", language: "tl" });
    expect(NewReport.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({ purok: null, what_happened: null, transcript: "Apat kami", english: "Four of us", language: "tl" });
  });
});

describe("safe list form", () => {
  it("needs a name, a barangay and where they are", () => {
    expect(validateSafe(emptySafe())).toEqual({ name: "Enter a name", barangay: "Pick a barangay", staying_at: "Enter where they are" });
    expect(validateSafe({ name: "Luz Ramos", barangay: "Sinonoc", staying_at: "At home", message: "" })).toEqual({});
  });

  it("builds a desk check-in the contract accepts", () => {
    const body = toSafeCheckin({ name: " Luz Ramos ", barangay: "Sinonoc", staying_at: " At home ", message: " " });
    expect(SafeCheckin.safeParse(body).success).toBe(true);
    expect(body).toEqual({ name: "Luz Ramos", barangay: "Sinonoc", staying_at: "At home", message: null, source: "desk" });
  });
});

const reply = (status: number, body: unknown = {}) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const down = (async () => {
  throw new TypeError("network");
}) as typeof fetch;

describe("saveReport", () => {
  it("posts the report as JSON and returns the code", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const spy = (async (url: RequestInfo | URL, init?: RequestInit) => {
      seen = { url: String(url), init };
      return new Response(JSON.stringify({ code: "Q3B7" }), { status: 201 });
    }) as typeof fetch;
    const report = toNewReport(filled, null);
    expect(await saveReport(report, spy)).toEqual({ ok: true, code: "Q3B7" });
    expect(seen!.url).toBe("/api/reports");
    expect(seen!.init?.method).toBe("POST");
    expect(JSON.parse(String(seen!.init?.body))).toMatchObject({ source: "desk" });
  });

  it("says what went wrong in words staff can act on", async () => {
    const report = toNewReport(filled, null);
    expect(await saveReport(report, reply(401))).toEqual({ ok: false, message: "The hub is locked. Unlock it and try again." });
    expect(await saveReport(report, reply(400))).toMatchObject({ ok: false, message: expect.stringContaining("Check the fields") });
    expect(await saveReport(report, reply(500))).toMatchObject({ ok: false });
    expect(await saveReport(report, down)).toEqual({ ok: false, message: "Could not reach the hub. Try again." });
  });

  it("treats a reply with no valid code as a failure", async () => {
    expect(await saveReport(toNewReport(filled, null), reply(201, { code: "nope" }))).toMatchObject({ ok: false });
  });
});

describe("saveCheckin", () => {
  const body = toSafeCheckin({ name: "Luz Ramos", barangay: "Sinonoc", staying_at: "At home", message: "" });

  it("returns ok when the hub saves it", async () => {
    expect(await saveCheckin(body, reply(201, { id: "x" }))).toEqual({ ok: true });
  });

  it("returns a message when it does not", async () => {
    expect(await saveCheckin(body, reply(403))).toMatchObject({ ok: false, message: "The hub is locked. Unlock it and try again." });
    expect(await saveCheckin(body, down)).toMatchObject({ ok: false });
  });
});
