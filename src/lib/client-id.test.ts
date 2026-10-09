import { describe, expect, it } from "vitest";
import { NewReport } from "@/lib/contracts";
import { newClientId } from "./client-id";

// A page served over plain HTTP has crypto.getRandomValues but no randomUUID.
const insecure = { getRandomValues: crypto.getRandomValues.bind(crypto) };

describe("newClientId", () => {
  it("builds a v4 UUID from getRandomValues when randomUUID is missing", () => {
    const ids = Array.from({ length: 50 }, () => newClientId(insecure));
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(NewReport.shape.client_id.safeParse(id).success).toBe(true);
    }
    expect(new Set(ids).size).toBe(50);
  });

  it("uses randomUUID where the browser has it", () => {
    expect(newClientId({ ...insecure, randomUUID: () => "3f6c2a1e-9b0d-4c55-8a7e-1d2f3a4b5c6d" })).toBe("3f6c2a1e-9b0d-4c55-8a7e-1d2f3a4b5c6d");
  });
});
