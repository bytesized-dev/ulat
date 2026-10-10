import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postTranslate } from "@/app/api/updates/translate/route";
import * as schema from "@/db/schema";
import { AiTranslation } from "@/lib/contracts";
import { translate } from "./index";
import { resetStructuredOutputProbe } from "./ollama";
import { TRANSLATE_SYSTEM } from "./prompts";

// Same setup as ai.test.ts: Ollama is a mocked fetch, the database is in memory
// and the staff session is a stub. Nothing here touches the real model.
vi.mock("../../db/client", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const sqlite = new Database(":memory:");
  sqlite.exec(
    "CREATE TABLE events (id text PRIMARY KEY NOT NULL, entity text NOT NULL, entity_id text NOT NULL, type text NOT NULL, actor text NOT NULL, data text, at text NOT NULL)",
  );
  return { db: drizzle({ client: sqlite }) };
});
vi.mock("@/lib/auth/session", () => ({
  requireStaff: async () =>
    session.staff ? { role: "staff", exp: Date.now() + 60_000 } : Response.json({ error: "unauthorized" }, { status: 401 }),
}));
const session = { staff: true };
let db: BetterSQLite3Database;

const english = { headline: "Water at the plaza", message: "Bring a container. One per family, 3:00 PM to 5:00 PM." };
const draft: AiTranslation = {
  ceb: "Tubig sa plaza. Pagdala og sudlanan. Usa matag pamilya, 3:00 PM hangtod 5:00 PM.",
  tl: "Tubig sa plaza. Magdala ng lalagyan. Isa bawat pamilya, 3:00 PM hanggang 5:00 PM.",
};

const reply = (content: string) =>
  Response.json({ model: "gemma4:e4b", message: { role: "assistant", content }, done: true });
const fetchMock = vi.fn();
const events = () => db.select().from(schema.events).all();

beforeEach(async () => {
  db = (await import("../../db/client")).db as unknown as typeof db;
  vi.stubEnv("OLLAMA_URL", "http://localhost:11434/");
  fetchMock.mockReset();
  resetStructuredOutputProbe();
  vi.stubGlobal("fetch", fetchMock);
  db.delete(schema.events).run();
  session.staff = true;
});

describe("translate", () => {
  it("sends the prompt and the English, returns the drafts and logs the raw output as ai.translate", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify(draft)));
    await expect(translate(english)).resolves.toEqual(draft);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:11434/api/chat");
    expect(body.messages).toEqual([
      { role: "system", content: TRANSLATE_SYSTEM },
      { role: "user", content: `Headline: ${english.headline}\nMessage: ${english.message}` },
    ]);
    const [row] = events();
    expect(row).toMatchObject({ entity: "ai", type: "ai.translate", actor: "system", data: { raw: JSON.stringify(draft) } });
    expect(row.entity_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("translates through the prompt when Ollama answers format with a 501", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"error":"structured output is unavailable"}', { status: 501 }))
      .mockResolvedValueOnce(reply("```json\n" + JSON.stringify(draft) + "\n```"));
    await expect(translate(english)).resolves.toEqual(draft);

    const retry = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(retry).not.toHaveProperty("format");
    expect(retry.messages[1].content).toContain(`Headline: ${english.headline}\nMessage: ${english.message}`);
    expect(retry.messages[1].content).toContain('"ceb"');
    expect(events()[0].type).toBe("ai.translate");
  });

  it("rejects a draft that changed a time, and logs it as ai.translate.failed with the raw output", async () => {
    const changed = { ...draft, tl: draft.tl.replace("5:00 PM", "5 ng hapon") };
    fetchMock.mockResolvedValue(reply(JSON.stringify(changed)));
    await expect(translate(english)).rejects.toMatchObject({ kind: "invalid_output", message: expect.stringContaining('tl time "5:00 PM"') });
    const [row] = events();
    expect(row.type).toBe("ai.translate.failed");
    expect(row.data).toMatchObject({ raw: JSON.stringify(changed), error: { kind: "invalid_output" } });
  });

  it("logs a schema failure with the raw output", async () => {
    fetchMock.mockResolvedValue(reply('{"ceb":"Tubig"}'));
    await expect(translate(english)).rejects.toMatchObject({ kind: "invalid_output" });
    expect(events()[0]).toMatchObject({ type: "ai.translate.failed", data: { raw: '{"ceb":"Tubig"}' } });
  });

  it("logs a timeout with no raw output", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    await expect(translate(english)).rejects.toMatchObject({ kind: "timeout" });
    expect(events()[0]).toMatchObject({ type: "ai.translate.failed", data: { raw: null, error: { kind: "timeout" } } });
  });

});

describe("POST /api/updates/translate", () => {
  const post = (body: unknown) =>
    postTranslate(new Request("http://hub/api/updates/translate", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

  it("returns an AiTranslation for the headline and message", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify(draft)));
    const response = await post(english);
    expect(response.status).toBe(200);
    expect(AiTranslation.parse(await response.json())).toEqual(draft);
  });

  it("returns 401 without a staff session and does not call the model", async () => {
    session.staff = false;
    const response = await post(english);
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events()).toHaveLength(0);
  });

  it.each([
    ["not json"],
    [{}],
    [{ headline: "Water" }],
    [{ headline: "   ", message: "x" }],
    [{ headline: "Water", message: "a".repeat(401) }],
    [{ headline: 5, message: "x" }],
  ])("rejects %j with 400", async (body) => {
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
    const response = await post(english);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error, retry: true });
  });

  it("returns 502 when the draft drops a number, so staff type it themselves", async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify({ ...draft, ceb: draft.ceb.replace("3:00 PM", "alas tres") })));
    const response = await post(english);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "invalid_output", retry: true });
  });
});
