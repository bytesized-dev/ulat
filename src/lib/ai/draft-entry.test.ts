// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { pushSQLiteSchema } from "drizzle-kit/api";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiPhotoDraft } from "../contracts";

const dir = mkdtempSync(join(tmpdir(), "ulat-draft-entry-"));
process.env.DATABASE_PATH = join(dir, "test.db");
process.env.UPLOAD_DIR = join(dir, "uploads");

// The model and the live bus are replaced, so nothing here needs Ollama.
// OllamaError stays real so the fallback sees the same class the client throws.
const chat = vi.hoisted(() => ({ chatJson: vi.fn() }));
vi.mock("./ollama", async (importOriginal) => ({ ...(await importOriginal<typeof import("./ollama")>()), chatJson: chat.chatJson }));
const bus = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("@/lib/live/bus", () => bus);

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const partial: AiPhotoDraft = {
  damage_class: "partial",
  confidence: "high",
  material: "light",
  hazards: ["Fallen power line"],
  reason: "Some roof sheets are missing but the walls stand.",
  need_more: null,
};
const rawReply = JSON.stringify(partial);

describe("draftEntry", () => {
  let draftEntry: typeof import("./draft-entry").draftEntry;
  let OllamaError: typeof import("./ollama").OllamaError;
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let number = 0;

  beforeAll(async () => {
    const sqlite = new Database(process.env.DATABASE_PATH!);
    schema = await import("@/db/schema");
    const push = await pushSQLiteSchema(schema as unknown as Record<string, unknown>, drizzle({ client: sqlite }) as never);
    sqlite.exec(push.statementsToExecute.join(String.fromCharCode(10)));
    sqlite.close();
    ({ db } = await import("@/db/client"));
    ({ draftEntry } = await import("./draft-entry"));
    ({ OllamaError } = await import("./ollama"));
    db.insert(schema.responders).values({ id: "r1", name: "Ana", team: "A", active: true }).run();
    mkdirSync(process.env.UPLOAD_DIR!, { recursive: true });
  });

  beforeEach(() => {
    vi.stubEnv("MOCK_AI", "0");
    chat.chatJson.mockReset();
    bus.publish.mockReset();
  });

  /** A saved draft with `labels.length` photos on disk. */
  function newEntry(labels: string[], note: string | null = null) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.insert(schema.entries)
      .values({
        id, number: ++number, responder_id: "r1", barangay: "Poblacion", purok: "Purok 2", household_head: "Dela Cruz",
        lat: 10.1, lng: 123.2, gps_accuracy_m: 8, note_transcript: note, status: "draft", created_at: now,
      })
      .run();
    labels.forEach((label, i) => {
      const path = `${id}-${i}.png`;
      writeFileSync(join(process.env.UPLOAD_DIR!, path), PNG);
      db.insert(schema.photos).values({ entry_id: id, path, label, taken_at: now }).run();
    });
    return id;
  }
  const entryRow = (id: string) => db.select().from(schema.entries).where(eq(schema.entries.id, id)).get()!;
  const auditRows = (id: string) => db.select().from(schema.events).where(eq(schema.events.entity_id, id)).all();

  it("makes one model call for the entry, stores the draft and emits entry.drafted", async () => {
    chat.chatJson.mockResolvedValue({ value: partial, raw: rawReply });
    const id = newEntry(["front", "roof"], "Wala na ang atop");
    await draftEntry(id);

    expect(chat.chatJson).toHaveBeenCalledTimes(1);
    const call = chat.chatJson.mock.calls[0][0];
    expect(call.system).toContain("Damage classes, from DSWD");
    expect(call.user).toContain("front, roof");
    expect(call.user).toContain("Wala na ang atop");
    expect(call.media).toHaveLength(2);
    expect(call.options).toEqual({ temperature: 0 });

    const row = entryRow(id);
    expect(row).toMatchObject({ ai_class: "partial", ai_confidence: "high", material: "light", hazards: ["Fallen power line"], ai_need_more: null });
    expect(bus.publish).toHaveBeenCalledWith({ type: "entry.drafted", entry_id: id });
  });

  it("logs the raw model text on the entry, not the parsed draft", async () => {
    const messy = `  ${rawReply}\n`;
    chat.chatJson.mockResolvedValue({ value: partial, raw: messy });
    const id = newEntry(["front"]);
    await draftEntry(id);
    const [row] = auditRows(id);
    expect(row).toMatchObject({ entity: "entry", type: "ai.photo", actor: "system", data: { raw: messy } });
  });

  it("passes an unclear draft through with the photo it asks for", async () => {
    const unclear: AiPhotoDraft = { ...partial, damage_class: "unclear", confidence: "low", need_more: "Roof from the side" };
    chat.chatJson.mockResolvedValue({ value: unclear, raw: JSON.stringify(unclear) });
    const id = newEntry(["front"]);
    await draftEntry(id);
    expect(entryRow(id)).toMatchObject({ ai_class: "unclear", ai_need_more: "Roof from the side" });
  });

  it("asks for a photo when the model says unclear without saying which", async () => {
    const unclear: AiPhotoDraft = { ...partial, damage_class: "unclear", confidence: "low", need_more: null };
    chat.chatJson.mockResolvedValue({ value: unclear, raw: JSON.stringify(unclear) });
    const id = newEntry(["front"]);
    await draftEntry(id);
    expect(entryRow(id)).toMatchObject({ ai_class: "unclear", ai_need_more: "Clear photo of the whole house" });
  });

  it("keeps the responder's material and hazards when they confirm while the model runs", async () => {
    const id = newEntry(["front", "roof"]);
    chat.chatJson.mockImplementation(async () => {
      // The responder confirms before the model answers.
      db.update(schema.entries)
        .set({ status: "confirmed", damage_class: "none", material: "concrete", hazards: [] })
        .where(eq(schema.entries.id, id))
        .run();
      return { value: partial, raw: rawReply };
    });
    await draftEntry(id);

    const row = entryRow(id);
    expect(row).toMatchObject({ status: "confirmed", damage_class: "none", material: "concrete", hazards: [] });
    // The draft is still recorded, and the screen still hears about it.
    expect(row).toMatchObject({ ai_class: "partial", ai_confidence: "high" });
    expect(bus.publish).toHaveBeenCalledWith({ type: "entry.drafted", entry_id: id });
  });

  it("falls back to unclear, logs the raw output and still emits when the output is invalid", async () => {
    chat.chatJson.mockRejectedValue(new OllamaError("invalid_output", "The reply was not JSON", "I think the roof is gone"));
    const id = newEntry(["front", "roof"]);
    await draftEntry(id);

    expect(entryRow(id)).toMatchObject({
      ai_class: "unclear",
      ai_confidence: "low",
      ai_need_more: "Clear photo of the whole house",
      ai_reason: "The AI could not decide from these photos.",
    });
    const [row] = auditRows(id);
    expect(row).toMatchObject({
      entity: "entry",
      type: "ai.photo.failed",
      data: { raw: "I think the roof is gone", error: { kind: "invalid_output", message: "The reply was not JSON" } },
    });
    expect(bus.publish).toHaveBeenCalledWith({ type: "entry.drafted", entry_id: id });
  });

  it("falls back to unclear when the model takes 60 seconds", async () => {
    // The real client, with a fetch that fails the way AbortSignal.timeout
    // does once OLLAMA_TIMEOUT_MS has passed. Node's timeout timer is not
    // driven by fake timers, so the abort is raised directly.
    const real = await vi.importActual<typeof import("./ollama")>("./ollama");
    chat.chatJson.mockImplementation(real.chatJson);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError")));
    try {
      const id = newEntry(["front", "roof"]);
      await draftEntry(id);

      expect(entryRow(id)).toMatchObject({ ai_class: "unclear", ai_confidence: "low", ai_need_more: "Clear photo of the whole house" });
      const [row] = auditRows(id);
      expect(row).toMatchObject({ type: "ai.photo.failed", data: { raw: null, error: { kind: "timeout" } } });
      expect(bus.publish).toHaveBeenCalledWith({ type: "entry.drafted", entry_id: id });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to unclear when no photo can be read, without calling the model", async () => {
    const id = newEntry([]);
    await draftEntry(id);
    expect(chat.chatJson).not.toHaveBeenCalled();
    expect(entryRow(id).ai_class).toBe("unclear");
    expect(bus.publish).toHaveBeenCalledWith({ type: "entry.drafted", entry_id: id });
  });

  it("returns the mock fixture under MOCK_AI without calling the model", async () => {
    vi.stubEnv("MOCK_AI", "1");
    const id = newEntry(["front", "roof"]);
    await draftEntry(id);
    expect(chat.chatJson).not.toHaveBeenCalled();
    expect(entryRow(id).ai_class).toBe("total");
    expect(bus.publish).toHaveBeenCalledWith({ type: "entry.drafted", entry_id: id });
  });
});
