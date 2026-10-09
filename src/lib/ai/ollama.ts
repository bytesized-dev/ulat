import { z } from "zod";
import { OLLAMA_MODEL, ollamaUrl } from "./config";

// The one Ollama client. BYT-9 (voice and text), BYT-25 (photos) and BYT-57
// (translation) all call chatJson with their own schema and prompt.

export const OLLAMA_TIMEOUT_MS = 60_000;

// Keeps the model loaded between calls so a family does not wait for a cold
// start. docs/SPEC.md section 5.
const KEEP_ALIVE = "30m";

export type OllamaFailure =
  /** No reply within 60 seconds. */
  | "timeout"
  /** Ollama is down, or answered with an HTTP error. */
  | "unavailable"
  /** The reply was not JSON, or did not match the schema. */
  | "invalid_output";

/** Carries the raw reply text when there was one, for the audit log. */
export class OllamaError extends Error {
  constructor(
    readonly kind: OllamaFailure,
    message: string,
    readonly raw: string | null = null,
  ) {
    super(message);
    this.name = "OllamaError";
  }
}

export type ChatJsonInput<S extends z.ZodType> = {
  schema: S;
  system: string;
  user: string;
  /** Images or audio for the user message. Sent base64 in `images`, the one binary field /api/chat has. */
  media?: Buffer[];
  /** Ollama's `options`, for example `{ temperature: 0 }`. Left out of the request when not set. */
  options?: Record<string, unknown>;
};

/**
 * Ask the model for JSON that matches `schema`. The schema goes to Ollama as
 * `format` and the reply is parsed with it again, so a model that ignores the
 * format still cannot hand back a wrong shape.
 */
export async function chatJson<S extends z.ZodType>(
  input: ChatJsonInput<S>,
): Promise<{ value: z.infer<S>; raw: string }> {
  const userMessage: Record<string, unknown> = { role: "user", content: input.user };
  if (input.media?.length) userMessage.images = input.media.map((buffer) => buffer.toString("base64"));

  let content: string;
  try {
    const response = await fetch(`${ollamaUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: z.toJSONSchema(input.schema),
        keep_alive: KEEP_ALIVE,
        ...(input.options ? { options: input.options } : {}),
        messages: [{ role: "system", content: input.system }, userMessage],
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new OllamaError("unavailable", `Ollama answered ${response.status}`, await response.text());
    }
    const body = (await response.json()) as { message?: { content?: unknown } };
    content = typeof body.message?.content === "string" ? body.message.content : "";
  } catch (error) {
    if (error instanceof OllamaError) throw error;
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new OllamaError("timeout", `No reply from Ollama in ${OLLAMA_TIMEOUT_MS / 1000} seconds`);
    }
    throw new OllamaError("unavailable", error instanceof Error ? error.message : "Ollama is unreachable");
  }

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new OllamaError("invalid_output", "The reply was not JSON", content);
  }
  const parsed = input.schema.safeParse(json);
  if (!parsed.success) {
    throw new OllamaError("invalid_output", `The reply did not match the schema: ${z.prettifyError(parsed.error)}`, content);
  }
  return { value: parsed.data, raw: content };
}
