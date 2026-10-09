import { describe, expect, it } from "vitest";
import { slipHousehold, slipHtml } from "./code-slip";

describe("slipHousehold", () => {
  it("calls the household by the last word of the name", () => {
    expect(slipHousehold("Pedro Santiago")).toBe("Santiago household");
    expect(slipHousehold("  ")).toBe("Household");
  });
});

describe("slipHtml", () => {
  it("prints the code and the household", () => {
    const html = slipHtml("Q3B7", "Pedro Santiago");
    expect(html).toContain("Q3B7");
    expect(html).toContain("Santiago household");
  });

  it("escapes a name that holds markup", () => {
    const html = slipHtml("Q3B7", `Pedro <script>alert("x")</script>`);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&#60;script&#62;");
  });
});
