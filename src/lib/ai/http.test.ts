import { describe, expect, it } from "vitest";
import { AiErrorBody } from "@/lib/contracts";
import * as http from "./http";

describe("AiErrorBody", () => {
  it("parses every error the AI routes send", () => {
    for (const error of AiErrorBody.shape.error.options) {
      expect(AiErrorBody.parse({ error, retry: false })).toEqual({ error, retry: false });
    }
    expect(AiErrorBody.parse({ error: "rejected", retry: false })).toEqual({ error: "rejected", retry: false });
  });

  it("rejects an unknown error or a missing retry", () => {
    expect(AiErrorBody.safeParse({ error: "nope", retry: true }).success).toBe(false);
    expect(AiErrorBody.safeParse({ error: "timeout" }).success).toBe(false);
  });

  it("is still exported from the AI http module as the same schema", () => {
    expect(http.AiErrorBody).toBe(AiErrorBody);
  });

  it.each([
    ["bad_request", 400, false],
    ["too_large", 413, false],
    ["rejected", 422, false],
    ["timeout", 504, true],
    ["unavailable", 503, true],
    ["invalid_output", 502, true],
  ] as const)("aiError(%s) answers %i with retry %s", async (error, status, retry) => {
    const response = http.aiError(error);
    expect(response.status).toBe(status);
    expect(AiErrorBody.parse(await response.json())).toEqual({ error, retry });
  });
});
