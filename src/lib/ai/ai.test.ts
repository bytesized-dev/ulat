import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postText } from "@/app/api/ai/text/route";
import { POST as postVoice } from "@/app/api/ai/voice/route";
import * as schema from "@/db/schema";
import { AiVoiceExtract } from "@/lib/contracts";
import { readText, readVoice } from "./index";
import { chatJson, OllamaError } from "./ollama";
import { z } from "zod";

// Ollama is replaced by a mocked fetch and the database by an in-memory file,
// so nothing here needs a model, audio or the hub's data/ulat.db.
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
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "usr", images: [Buffer.from("abc").toString("base64")] },
      ],
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
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
