import { z } from "zod";
import { OllamaError } from "./ollama";

// What the AI routes send back when they cannot return an extract. The family
// screen shows a retry button when `retry` is true. This lives here, not in
// src/lib/contracts, until CJ moves it there.

export const AiErrorBody = z.object({
  error: z.enum(["bad_request", "too_large", "timeout", "unavailable", "invalid_output"]),
  retry: z.boolean(),
});
export type AiErrorBody = z.infer<typeof AiErrorBody>;

const STATUS: Record<AiErrorBody["error"], number> = {
  bad_request: 400,
  too_large: 413,
  timeout: 504,
  unavailable: 503,
  invalid_output: 502,
};

export function aiError(error: AiErrorBody["error"]): Response {
  const body: AiErrorBody = { error, retry: error !== "bad_request" && error !== "too_large" };
  return Response.json(body, { status: STATUS[error], headers: { "Cache-Control": "no-store" } });
}

/** Turn a failed model call into a response. Anything else is a bug and rethrows. */
export function aiFailure(error: unknown): Response {
  if (error instanceof OllamaError) return aiError(error.kind);
  throw error;
}
