// Where Ollama runs and which model the hub uses. The hub status probe and the
// Ollama calls in BYT-9, BYT-25 and BYT-57 all read these.

export const OLLAMA_MODEL = "gemma4:e4b";

/** The Ollama base URL, from OLLAMA_URL, without a trailing slash. */
export function ollamaUrl(): string {
  return (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "");
}
