import { AiErrorBody } from "@/lib/contracts";
import { OllamaError } from "./ollama";

// The shape of the error body lives in src/lib/contracts. It is re-exported so
// code that imports it from here keeps working.
export { AiErrorBody };

type AiErrorKind = AiErrorBody["error"];

const STATUS: Record<AiErrorKind, number> = {
  bad_request: 400,
  too_large: 413,
  rejected: 422,
  timeout: 504,
  unavailable: 503,
  invalid_output: 502,
};

// Sending the same request again cannot change these.
const FINAL: ReadonlySet<AiErrorKind> = new Set(["bad_request", "too_large", "rejected"]);

/** `status` overrides the usual one, for example 411 on a bad_request. */
export function aiError(error: AiErrorKind, status: number = STATUS[error]): Response {
  const body: AiErrorBody = { error, retry: !FINAL.has(error) };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Turn a failed model call into a response. Anything else is a bug and rethrows. */
export function aiFailure(error: unknown): Response {
  if (error instanceof OllamaError) return aiError(error.kind);
  throw error;
}
