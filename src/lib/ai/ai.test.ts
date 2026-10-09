import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postText } from "@/app/api/ai/text/route";
import { POST as postVoice } from "@/app/api/ai/voice/route";
import * as schema from "@/db/schema";
import { AiPhotoDraft, AiVoiceExtract } from "@/lib/contracts";
import { draftPhoto, readText, readVoice } from "./index";
import { chatJson, OllamaError, resetStructuredOutputProbe } from "./ollama";
import { z } from "zod";

// Ollama is replaced by a mocked fetch, ffmpeg by a pass through and the
// database by an in-memory file, so nothing here needs a model, audio or the
// hub's data/ulat.db.
vi.mock("./audio", () => ({ toWav: async (audio: Buffer) => audio }));
vi.mock("../../db/client", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const sqlite = new Database(":memory:");
  sqlite.exec(
    "CREATE TABLE events (id text PRIMARY KEY NOT NULL, entity text NOT NULL, entity_id text NOT NULL, type text NOT NULL, actor text NOT NULL, data text, at text NOT NULL)",
  );
  return { db: drizzle({ client: sqlite }) };
});
let db: BetterSQLite3Database;

const extract: AiVoiceExtract = {
  language: "ceb",
  transcript: "Wala na ang atop, duha ang nasamdan.",
  english: "The roof is gone, two are hurt.",
  household_head: null,
  people: 5,
  hurt: 2,
  missing: null,
  what_happened: "The roof is gone.",
  needs: ["tarp", "medicine"],
  hazards: [],
  uncertain_fields: ["hurt"],
};

const reply = (content: string) =>
  Response.json({ model: "gemma4:e4b", message: { role: "assistant", content }, done: true });

const fetchMock = vi.fn();
const events = () => db.select().from(schema.events).all();

beforeEach(async () => {
  db = (await import("../../db/client")).db as unknown as typeof db;
  vi.stubEnv("MOCK_AI", "0");
  vi.stubEnv("OLLAMA_URL", "http://localhost:11434/");
  fetchMock.mockReset();
  resetStructuredOutputProbe();
  vi.stubGlobal("fetch", fetchMock);
  db.delete(schema.events).run();
});

describe("chatJson", () => {
  const schemaUnderTest = z.object({ n: z.number() });
  const call = () => chatJson({ schema: schemaUnderTest, system: "sys", user: "usr", media: [Buffer.from("abc")] });

  it("sends the schema, keep_alive and base64 media, and returns value and raw", async () => {
    fetchMock.mockResolvedValue(reply('{"n":3}'));
    await expect(call()).resolves.toEqual({ value: { n: 3 }, raw: '{"n":3}' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: "gemma4:e4b",
      stream: false,
      format: z.toJSONSchema(schemaUnderTest),
      keep_alive: expect.any(String),
      think: false,
      options: { num_predict: 1536 },
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "usr", images: [Buffer.from("abc").toString("base64")] },
      ],
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("merges caller options over the num_predict cap and lets a call turn thinking back on", async () => {
    fetchMock.mockImplementation(async () => reply('{"n":3}'));
    await chatJson({ schema: schemaUnderTest, system: "sys", user: "usr", options: { temperature: 0 }, think: true });
    await chatJson({ schema: schemaUnderTest, system: "sys", user: "usr", options: { num_predict: 4096 } });

    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(first.think).toBe(true);
    expect(first.options).toEqual({ num_predict: 1536, temperature: 0 });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).options).toEqual({ num_predict: 4096 });
  });

  it("throws invalid_output with the raw text when the reply is not JSON", async () => {
    fetchMock.mockResolvedValue(reply("Sure! Here you go"));
    await expect(call()).rejects.toMatchObject({ kind: "invalid_output", raw: "Sure! Here you go" });
  });

  it("throws invalid_output with the raw text when the reply does not match the schema", async () => {
    fetchMock.mockResolvedValue(reply('{"n":"three"}'));
    const error = await call().catch((e) => e);
    expect(error).toBeInstanceOf(OllamaError);
    expect(error).toMatchObject({ kind: "invalid_output", raw: '{"n":"three"}' });
  });

  it("throws timeout when the abort signal fires", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    await expect(call()).rejects.toMatchObject({ kind: "timeout", raw: null });
  });

  it("aborts after 60 seconds", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(reply('{"n":1}'));
    await call();
    expect(timeout).toHaveBeenCalledWith(60_000);
  });

  it("throws unavailable when Ollama is down or answers with an error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(call()).rejects.toMatchObject({ kind: "unavailable" });
    fetchMock.mockResolvedValueOnce(new Response("overloaded", { status: 500 }));
    await expect(call()).rejects.toMatchObject({ kind: "unavailable", raw: "overloaded" });
  });

  it("throws rejected for an Ollama 4xx, but not for 408 or 429", async () => {
    fetchMock.mockResolvedValueOnce(new Response("model not found", { status: 404 }));
    await expect(call()).rejects.toMatchObject({ kind: "rejected", raw: "model not found" });
    fetchMock.mockResolvedValueOnce(new Response("bad audio", { status: 400 }));
    await expect(call()).rejects.toMatchObject({ kind: "rejected", raw: "bad audio" });
    fetchMock.mockResolvedValueOnce(new Response("slow", { status: 408 }));
    await expect(call()).rejects.toMatchObject({ kind: "unavailable" });
    fetchMock.mockResolvedValueOnce(new Response("busy", { status: 429 }));
    await expect(call()).rejects.toMatchObject({ kind: "unavailable" });
  });
});

describe("chatJson when the reply hits the token cap", () => {
  const schemaUnderTest = z.object({ n: z.number() });
  const cut = '{"n":';
  const capped = (content: string) =>
    Response.json({ model: "gemma4:e4b", message: { role: "assistant", content }, done: true, done_reason: "length" });
  const call = () => chatJson({ schema: schemaUnderTest, system: "sys", user: "usr" });

  it("throws invalid_output that names the cap and keeps the raw text", async () => {
    fetchMock.mockResolvedValue(capped(cut));
    const error = await call().catch((e) => e);
    expect(error).toBeInstanceOf(OllamaError);
    expect(error).toMatchObject({ kind: "invalid_output", message: "The reply hit the 1536 token cap", raw: cut });
  });

  it("throws it even when the cut-off text happens to be valid JSON", async () => {
    fetchMock.mockResolvedValue(capped('{"n":3}'));
    await expect(call()).rejects.toMatchObject({ kind: "invalid_output", message: "The reply hit the 1536 token cap" });
  });

  it("throws it on the prompt retry after a 501", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"error":"structured output is unavailable"}', { status: 501 }))
      .mockResolvedValueOnce(capped(cut));
    await expect(call()).rejects.toMatchObject({ kind: "invalid_output", message: "The reply hit the 1536 token cap", raw: cut });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("names the num_predict the call sent when the caller raised it", async () => {
    fetchMock.mockResolvedValue(capped(cut));
    const error = await chatJson({ schema: schemaUnderTest, system: "sys", user: "usr", options: { num_predict: 4096 } }).catch((e) => e);
    expect(error).toMatchObject({ kind: "invalid_output", message: "The reply hit the 4096 token cap", raw: cut });
  });

  it("accepts a normal stop", async () => {
    fetchMock.mockResolvedValue(Response.json({ message: { content: '{"n":3}' }, done: true, done_reason: "stop" }));
    await expect(call()).resolves.toMatchObject({ value: { n: 3 } });
  });

  it("is audited as ai.text.failed with the cut-off reply", async () => {
    fetchMock.mockResolvedValue(capped('{"language":"ceb","english":"The ro'));
    await expect(readText({ text: "hello" })).rejects.toMatchObject({ kind: "invalid_output" });
    expect(events()[0]).toMatchObject({
      type: "ai.text.failed",
      data: { raw: '{"language":"ceb","english":"The ro', error: { kind: "invalid_output", message: "The reply hit the 1536 token cap" } },
    });
  });
});

describe("chatJson without structured output", () => {
  const schemaUnderTest = z.object({ n: z.number(), note: z.string().nullable() });
  const call = () => chatJson({ schema: schemaUnderTest, system: "sys", user: "usr", media: [Buffer.from("abc")] });
  const noFormat = () => new Response(JSON.stringify({ error: "structured output is unavailable" }), { status: 501 });
  const bodyOf = (n: number) => JSON.parse(fetchMock.mock.calls[n][1].body);
  const good = '{"n":3,"note":null}';

  it("retries a 501 once without format and puts the schema in the user message", async () => {
    fetchMock.mockResolvedValueOnce(noFormat()).mockResolvedValueOnce(reply(good));
    await expect(call()).resolves.toEqual({ value: { n: 3, note: null }, raw: good });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(0).format).toEqual(z.toJSONSchema(schemaUnderTest));
    const retry = bodyOf(1);
    expect(retry).not.toHaveProperty("format");
    expect(retry).toMatchObject({
      model: "gemma4:e4b",
      stream: false,
      keep_alive: expect.any(String),
      think: false,
      options: { num_predict: 1536 },
    });
    expect(retry.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(retry.messages[1].images).toEqual([Buffer.from("abc").toString("base64")]);
    expect(retry.messages[1].content).toContain("usr");
    expect(retry.messages[1].content).toContain(JSON.stringify(z.toJSONSchema(schemaUnderTest)));
    expect(retry.messages[1].content).toContain("one JSON object only, no code fence");
    expect(retry.messages[1].content).toContain("Every key must be present");
  });

  it("also falls back on any status when the body says structured output is unavailable", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("structured output is unavailable", { status: 500 }))
      .mockResolvedValueOnce(reply(good));
    await expect(call()).resolves.toMatchObject({ value: { n: 3 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("remembers the fallback and skips format on later calls", async () => {
    fetchMock.mockResolvedValueOnce(noFormat()).mockImplementation(async () => reply(good));
    await call();
    await call();
    await call();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(bodyOf(2)).not.toHaveProperty("format");
    expect(bodyOf(3)).not.toHaveProperty("format");
    expect(bodyOf(3).messages[1].content).toContain("JSON schema");
  });

  it("adds the schema hint to the prompt only in prompt mode", async () => {
    const withHint = () => chatJson({ schema: schemaUnderTest, system: "sys", user: "usr", schemaHint: "Use null for note." });
    fetchMock.mockResolvedValueOnce(noFormat()).mockImplementation(async () => reply(good));
    await withHint();
    expect(bodyOf(0).messages[1].content).toBe("usr");
    expect(bodyOf(1).messages[1].content).toContain("Use null for note.");
  });

  it("does not fall back on other errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    await expect(call()).rejects.toMatchObject({ kind: "unavailable", status: 500 });
    fetchMock.mockResolvedValueOnce(new Response("bad audio", { status: 400 }));
    await expect(call()).rejects.toMatchObject({ kind: "rejected", status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("parses a reply wrapped in a code fence", async () => {
    for (const fenced of ["```json\n" + good + "\n```", "```\n" + good + "\n```", "  ```json\n" + good + "  ", good + "\n```"]) {
      fetchMock.mockResolvedValueOnce(reply(fenced));
      await expect(call()).resolves.toEqual({ value: { n: 3, note: null }, raw: fenced });
    }
  });

  it("throws invalid_output with the raw reply when the fallback reply is invalid", async () => {
    fetchMock.mockResolvedValueOnce(noFormat()).mockResolvedValueOnce(reply('```json\n{"n":"three"}\n```'));
    await expect(call()).rejects.toMatchObject({ kind: "invalid_output", raw: '```json\n{"n":"three"}\n```' });
    fetchMock.mockResolvedValueOnce(reply('{"n":3}'));
    await expect(call()).rejects.toMatchObject({ kind: "invalid_output", raw: '{"n":3}' });
    fetchMock.mockResolvedValueOnce(reply("I cannot do that"));
    await expect(call()).rejects.toMatchObject({ kind: "invalid_output", raw: "I cannot do that" });
  });

  it("reads a network error as unreachable, with no status, and does not fall back", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const error = await call().catch((e) => e);
    expect(error).toMatchObject({ kind: "unavailable", status: null, raw: null });
    expect(error.message).toBe("Request to Ollama failed: fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads an error from a reachable Ollama as an HTTP error, not as unreachable", async () => {
    fetchMock.mockResolvedValueOnce(noFormat()).mockResolvedValueOnce(new Response("model crashed", { status: 500 }));
    const error = await call().catch((e) => e);
    expect(error).toMatchObject({ kind: "unavailable", status: 500, raw: "model crashed", message: "Ollama answered 500" });
  });
});

describe("voice, text and photo when Ollama answers format with a 501", () => {
  const noFormat = () => new Response('{"error":"structured output is unavailable"}', { status: 501 });
  const photo: AiPhotoDraft = {
    damage_class: "partial",
    confidence: "high",
    material: "light",
    hazards: [],
    reason: "Some roof sheets are missing but the walls stand.",
    need_more: null,
  };
  const bodyOf = (n: number) => JSON.parse(fetchMock.mock.calls[n][1].body);

  it("reads a voice note through the prompt and audits the raw reply", async () => {
    const fenced = "```json\n" + JSON.stringify(extract) + "\n```";
    fetchMock.mockResolvedValueOnce(noFormat()).mockResolvedValueOnce(reply(fenced));
    await expect(readVoice({ audio: Buffer.from("x"), mime: "audio/webm" })).resolves.toEqual(extract);

    expect(bodyOf(1)).not.toHaveProperty("format");
    expect(bodyOf(1).messages[1].images).toHaveLength(1);
    expect(bodyOf(1).messages[1].content).toContain('"transcript"');
    expect(events()[0]).toMatchObject({ type: "ai.voice", data: { raw: fenced } });
  });

  it("reads a typed note through the prompt", async () => {
    fetchMock.mockResolvedValueOnce(noFormat()).mockResolvedValueOnce(reply(JSON.stringify(extract)));
    await expect(readText({ text: "Wala na ang atop" })).resolves.toEqual({ ...extract, transcript: "" });
    expect(bodyOf(1).messages[1].content).toMatch(/^Wala na ang atop\n\n/);
    expect(bodyOf(1).messages[1].content).not.toContain('"transcript"');
    expect(bodyOf(1).messages[1].content).toContain('"english"');
  });

  it("drafts a photo through the prompt, with the need_more hint and temperature 0", async () => {
    fetchMock.mockResolvedValueOnce(noFormat()).mockResolvedValueOnce(reply(JSON.stringify(photo)));
    await expect(draftPhoto({ photos: [{ data: Buffer.from("img"), mime: "image/jpeg", label: "Front" }] })).resolves.toEqual(photo);

    expect(bodyOf(1)).not.toHaveProperty("format");
    expect(bodyOf(1).options).toEqual({ num_predict: 1536, temperature: 0 });
    expect(bodyOf(1).think).toBe(false);
    expect(bodyOf(1).messages[1].content).toContain("Use null for need_more when damage_class is not unclear.");
    expect(bodyOf(1).messages[1].content).toContain('"need_more"');
  });

  it("audits an invalid fallback reply as ai.voice.failed with the raw output", async () => {
    const bad = JSON.stringify({ ...extract, people: -1 });
    fetchMock.mockResolvedValueOnce(noFormat()).mockResolvedValueOnce(reply(bad));
    await expect(readVoice({ audio: Buffer.from("x"), mime: "audio/webm" })).rejects.toMatchObject({ kind: "invalid_output", raw: bad });
    expect(events()[0]).toMatchObject({ type: "ai.voice.failed", data: { raw: bad, error: { kind: "invalid_output" } } });
  });

  it("logs a reachable Ollama's error with its status, not as a lost connection", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(readText({ text: "hello" })).rejects.toMatchObject({ kind: "unavailable", status: 500 });
    expect(events()[0]).toMatchObject({
      type: "ai.text.failed",
      data: { raw: "boom", error: { kind: "unavailable", message: "Ollama answered 500" } },
    });
  });
});

describe("readVoice and readText", () => {
  it("returns the model's extract and logs the raw output as ai.voice", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify(extract)));
    await expect(readVoice({ audio: Buffer.from("x"), mime: "audio/webm" })).resolves.toEqual(extract);

    const [row] = events();
    expect(row).toMatchObject({ entity: "ai", type: "ai.voice", actor: "system", data: { raw: JSON.stringify(extract) } });
    expect(row.entity_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].images).toHaveLength(1);
  });

  it("empties the transcript for a typed note and sends the text as the user message", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify(extract)));
    const result = await readText({ text: "Wala na ang atop" });
    expect(result).toEqual({ ...extract, transcript: "" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[1]).toEqual({ role: "user", content: "Wala na ang atop" });
    expect(events()[0].type).toBe("ai.text");
  });

  it("leaves transcript out of the schema for a typed note, even if the model writes one", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify(extract)));
    await expect(readText({ text: "Wala na ang atop" })).resolves.toEqual({ ...extract, transcript: "" });

    const { properties, required } = JSON.parse(fetchMock.mock.calls[0][1].body).format;
    expect(properties).not.toHaveProperty("transcript");
    expect(required).not.toContain("transcript");
    expect(properties).toHaveProperty("english");
  });

  it("keeps transcript in the schema for a voice note", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify(extract)));
    await readVoice({ audio: Buffer.from("x"), mime: "audio/webm" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).format.properties).toHaveProperty("transcript");
  });

  it("logs a schema failure as ai.voice.failed with the raw output and the error", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify({ ...extract, people: -1 })));
    await expect(readVoice({ audio: Buffer.from("x"), mime: "audio/webm" })).rejects.toBeInstanceOf(OllamaError);
    const [row] = events();
    expect(row.type).toBe("ai.voice.failed");
    expect(row.data).toMatchObject({ raw: expect.stringContaining('"people":-1'), error: { kind: "invalid_output" } });
  });

  it("logs a timeout as ai.text.failed with no raw output", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    await expect(readText({ text: "hello" })).rejects.toMatchObject({ kind: "timeout" });
    expect(events()[0]).toMatchObject({ type: "ai.text.failed", data: { raw: null, error: { kind: "timeout" } } });
  });

  it("returns the fixtures and logs nothing under MOCK_AI=1", async () => {
    vi.stubEnv("MOCK_AI", "1");
    AiVoiceExtract.parse(await readVoice({ audio: Buffer.from("x"), mime: "audio/webm" }));
    AiVoiceExtract.parse(await readText({ text: "hello" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events()).toHaveLength(0);
  });
});

describe("POST /api/ai/text", () => {
  const post = (body: unknown) =>
    postText(new Request("http://hub/api/ai/text", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

  it("returns an AiVoiceExtract with an empty transcript", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify(extract)));
    const response = await post({ text: "  Wala na ang atop  " });
    expect(response.status).toBe(200);
    expect(AiVoiceExtract.parse(await response.json())).toMatchObject({ transcript: "", english: extract.english });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content).toBe("Wala na ang atop");
  });

  it.each([["not json"], [{}], [{ text: "   " }], [{ text: "a".repeat(501) }], [{ text: 5 }]])("rejects %j with 400", async (body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "bad_request", retry: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [new DOMException("timed out", "TimeoutError"), 504, "timeout"],
    [new TypeError("fetch failed"), 503, "unavailable"],
  ])("maps %s to a retryable %i", async (failure, status, error) => {
    fetchMock.mockRejectedValue(failure);
    const response = await post({ text: "hello" });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error, retry: true });
  });

  it("works when Ollama answers format with a 501", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"structured output is unavailable"}', { status: 501 })).mockResolvedValue(reply(JSON.stringify(extract)));
    const response = await post({ text: "Wala na ang atop" });
    expect(response.status).toBe(200);
    expect(AiVoiceExtract.parse(await response.json())).toMatchObject({ transcript: "", english: extract.english });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("format");
  });

  it("returns 502 with retry when the model's output fails the schema", async () => {
    fetchMock.mockResolvedValue(reply('{"language":"klingon"}'));
    const response = await post({ text: "hello" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "invalid_output", retry: true });
  });
});

describe("POST /api/ai/voice", () => {
  const MB = 1024 * 1024;
  // A Request built from FormData has no Content-Length header until it goes over
  // the wire, so serialize it and set the header the way a real upload carries it.
  const post = async (form: FormData) => {
    const probe = new Request("http://hub/api/ai/voice", { method: "POST", body: form });
    const body = new Uint8Array(await probe.arrayBuffer());
    const headers = { "content-type": probe.headers.get("content-type")!, "content-length": String(body.byteLength) };
    return postVoice(new Request("http://hub/api/ai/voice", { method: "POST", body, headers }));
  };
  const upload = (file: File | string | null) => {
    const form = new FormData();
    if (file !== null) form.set("audio", file);
    return form;
  };
  const audioFile = (bytes: number, type: string) => new File([new Uint8Array(bytes)], "note", { type });
  const clip = audioFile(1000, "audio/webm;codecs=opus");

  it("returns an AiVoiceExtract for an audio upload", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify(extract)));
    const response = await post(upload(clip));
    expect(response.status).toBe(200);
    expect(AiVoiceExtract.parse(await response.json())).toEqual(extract);
  });

  it("rejects a missing field, a non-audio file and an empty file with 400", async () => {
    for (const form of [
      upload(null),
      upload("text"),
      upload(new File(["x"], "a.txt", { type: "text/plain" })),
      upload(new File([], "a.webm", { type: "audio/webm" })),
    ]) {
      const response = await post(form);
      expect(response.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["audio/webm;codecs=opus", "audio/ogg", "audio/mp4", "audio/mpeg"])("rejects a %s clip over 1 MB with 413 and no retry", async (type) => {
    const response = await post(upload(audioFile(MB + 1, type)));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "too_large", retry: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a compressed clip of exactly 1 MB", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify(extract)));
    expect((await post(upload(audioFile(MB, "audio/webm")))).status).toBe(200);
  });

  it("allows a wav up to 6 MB and rejects one over it with 413 and no retry", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify(extract)));
    expect((await post(upload(audioFile(6 * MB, "audio/wav")))).status).toBe(200);

    const response = await post(upload(audioFile(6 * MB + 1, "audio/wav")));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "too_large", retry: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a Content-Length over the largest cap without reading the body", async () => {
    const request = new Request("http://hub/api/ai/voice", {
      method: "POST",
      body: upload(clip),
      headers: { "content-length": String(7 * MB) },
    });
    const formData = vi.spyOn(request, "formData");
    const response = await postVoice(request);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "too_large", retry: false });
    expect(formData).not.toHaveBeenCalled();
  });

  it.each([[null], ["abc"], ["-5"], ["1e3"], [""]])("rejects Content-Length %j with 411 without reading the body", async (length) => {
    const body = new ReadableStream();
    const headers: Record<string, string> = { "content-type": "multipart/form-data; boundary=x" };
    if (length !== null) headers["content-length"] = length;
    const request = new Request("http://hub/api/ai/voice", { method: "POST", body, headers, duplex: "half" } as RequestInit);
    const formData = vi.spyOn(request, "formData");

    const response = await postVoice(request);
    expect(response.status).toBe(411);
    expect(await response.json()).toEqual({ error: "bad_request", retry: false });
    expect(formData).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a timeout to 504 with retry", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const response = await post(upload(clip));
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "timeout", retry: true });
  });

  it("maps an Ollama 400 to a final 422 and an Ollama 500 to a retryable 503", async () => {
    fetchMock.mockResolvedValueOnce(new Response("unsupported audio", { status: 400 }));
    const rejected = await post(upload(clip));
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toEqual({ error: "rejected", retry: false });

    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    const down = await post(upload(clip));
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ error: "unavailable", retry: true });
  });
});
