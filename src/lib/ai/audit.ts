import type { OllamaError } from "./ollama";

/**
 * Write one model call to the events table: entity "ai", a fresh UUID because
 * there is no report or entry yet, and the raw output. Failures get a
 * ".failed" type and carry the error. docs/SPEC.md sections 3 and 5.
 *
 * The database loads on first use, so MOCK_AI runs and tests that never log
 * do not open the file. A failed write is logged and swallowed: losing an
 * audit row must not throw away a family's extraction.
 */
export async function logAiCall(call: "voice" | "text" | "photo" | "translate", result: { raw: string | null; error?: OllamaError }) {
  try {
    const [{ db }, { events }] = await Promise.all([import("../../db/client"), import("../../db/schema")]);
    db.insert(events)
      .values({
        entity: "ai",
        entity_id: crypto.randomUUID(),
        type: result.error ? `ai.${call}.failed` : `ai.${call}`,
        actor: "system",
        data: {
          raw: result.raw,
          ...(result.error ? { error: { kind: result.error.kind, message: result.error.message } } : {}),
        },
        at: new Date().toISOString(),
      })
      .run();
  } catch (error) {
    console.error("Could not write the AI audit event", error);
  }
}

/**
 * Same as logAiCall for a call that belongs to an entry: the row is entity
 * "entry" with the entry id, so it shows in that entry's history. Used by the
 * photo draft (BYT-25), where the entry exists before the model runs.
 */
export async function logEntryAiCall(
  entryId: string,
  call: Parameters<typeof logAiCall>[0],
  result: { raw: string | null; error?: OllamaError | Error },
) {
  try {
    const [{ db }, { events }] = await Promise.all([import("../../db/client"), import("../../db/schema")]);
    const kind = result.error && "kind" in result.error ? result.error.kind : undefined;
    db.insert(events)
      .values({
        entity: "entry",
        entity_id: entryId,
        type: result.error ? `ai.${call}.failed` : `ai.${call}`,
        actor: "system",
        data: {
          raw: result.raw,
          ...(result.error ? { error: { ...(kind ? { kind } : {}), message: result.error.message } } : {}),
        },
        at: new Date().toISOString(),
      })
      .run();
  } catch (error) {
    console.error("Could not write the AI audit event", error);
  }
}
