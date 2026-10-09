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
  /** Ollama is down (no `status`), or answered with a 5xx, 408 or 429 (`status` set). */
  | "unavailable"
  /** Ollama refused the request with another 4xx. Sending it again cannot work. */
  | "rejected"
  /** The reply was not JSON, or did not match the schema. */
  | "invalid_output";

/**
 * Carries the raw reply text when there was one, for the audit log, and the
 * HTTP status when Ollama answered. A null `status` on an "unavailable" error
 * means the connection itself failed.
 */
export class OllamaError extends Error {
  constructor(
    readonly kind: OllamaFailure,
    message: string,
    readonly raw: string | null = null,
    readonly status: number | null = null,
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
  /** Extra line for the schema instructions, used only when the schema goes in the prompt. */
  schemaHint?: string;
};

// Some Ollama builds, such as Homebrew 0.40.2 on the MLX runner, ship without
// libollama_xgrammar and answer any request with `format` with a 501. Once that
// happens the schema goes in the prompt for every later call in this process.
let promptMode = false;

/** Forget that Ollama lacks structured output. For tests. */
export function resetStructuredOutputProbe() {
  promptMode = false;
}

// A bare 501 counts on purpose, so a reworded error message still triggers the fallback.
function lacksStructuredOutput(error: OllamaError) {
  return error.status === 501 || /structured output is unavailable/i.test(error.raw ?? "");
}

function schemaInstructions(schema: z.ZodType, hint?: string) {
  return [
    "Reply with one JSON object only, no code fence, that matches this JSON schema:",
    JSON.stringify(z.toJSONSchema(schema)),
    `Every key must be present. Use null for a key that has no value.${hint ? ` ${hint}` : ""}`,
  ].join("\n");
}

/** Models often wrap JSON in a markdown fence when they are not held to a format. */
function stripCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```[\w-]*[ \t]*\r?\n?/, "")
    .replace(/\r?\n?[ \t]*```$/, "")
    .trim();
}

/** One POST to /api/chat. Returns the reply text, or throws an OllamaError. */
async function chat<S extends z.ZodType>(input: ChatJsonInput<S>, withFormat: boolean): Promise<string> {
  const user = withFormat ? input.user : `${input.user}\n\n${schemaInstructions(input.schema, input.schemaHint)}`;
  const userMessage: Record<string, unknown> = { role: "user", content: user };
  if (input.media?.length) userMessage.images = input.media.map((buffer) => buffer.toString("base64"));

  try {
    const response = await fetch(`${ollamaUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        ...(withFormat ? { format: z.toJSONSchema(input.schema) } : {}),
        keep_alive: KEEP_ALIVE,
        ...(input.options ? { options: input.options } : {}),
        messages: [{ role: "system", content: input.system }, userMessage],
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
    if (!response.ok) {
      // A 4xx means Ollama refused this input. 408 and 429 are about timing, so they can pass later.
      const refused = response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429;
      throw new OllamaError(
        refused ? "rejected" : "unavailable",
        `Ollama answered ${response.status}`,
        await response.text(),
        response.status,
      );
    }
    const body = (await response.json()) as { message?: { content?: unknown } };
    return typeof body.message?.content === "string" ? body.message.content : "";
  } catch (error) {
    if (error instanceof OllamaError) throw error;
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new OllamaError("timeout", `No reply from Ollama in ${OLLAMA_TIMEOUT_MS / 1000} seconds`);
    }
    throw new OllamaError("unavailable", `Request to Ollama failed: ${error instanceof Error ? error.message : "no connection"}`);
  }
}

/**
 * Ask the model for JSON that matches `schema`. The schema goes to Ollama as
 * `format` and the reply is parsed with it again, so a model that ignores the
 * format still cannot hand back a wrong shape. If Ollama has no structured
 * output, the call is sent again with the schema in the user message, and
 * every later call does the same. A reply wrapped in a code fence is unwrapped.
 * The raw reply is returned and attached to errors as it came, fence included.
 */
export async function chatJson<S extends z.ZodType>(
  input: ChatJsonInput<S>,
): Promise<{ value: z.infer<S>; raw: string }> {
  let content: string;
  if (promptMode) {
    content = await chat(input, false);
  } else {
    try {
      content = await chat(input, true);
    } catch (error) {
      if (!(error instanceof OllamaError) || !lacksStructuredOutput(error)) throw error;
      // Set before the retry on purpose: Ollama said it has no format, even if this retry fails.
      promptMode = true;
      content = await chat(input, false);
    }
  }

  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(content));
  } catch {
    throw new OllamaError("invalid_output", "The reply was not JSON", content);
  }
  const parsed = input.schema.safeParse(json);
  if (!parsed.success) {
    throw new OllamaError("invalid_output", `The reply did not match the schema: ${z.prettifyError(parsed.error)}`, content);
  }
  return { value: parsed.data, raw: content };
}
