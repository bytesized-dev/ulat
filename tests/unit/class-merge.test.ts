import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cn, typeScale } from "../../src/lib/utils";

// A size from the type scale and a text colour are both "text-" plus a word,
// so the class merger will treat them as one group and drop one unless it is
// told the scale by name.

describe("class merging keeps type and colour apart", () => {
  it("keeps a text colour when a type size is merged after it", () => {
    expect(cn("text-on-action", "text-body")).toContain("text-on-action");
    expect(cn("text-error", "text-label")).toContain("text-error");
    expect(cn("text-text-2", "text-small")).toContain("text-text-2");
  });

  it("still lets one type size replace another", () => {
    const merged = cn("text-body", "text-title");
    expect(merged).toContain("text-title");
    expect(merged).not.toContain("text-body");
  });

  it("still lets one text colour replace another", () => {
    const merged = cn("text-text-2", "text-error");
    expect(merged).toContain("text-error");
    expect(merged).not.toContain("text-text-2");
  });
});

describe("the scale named in utils matches the one in globals.css", () => {
  it("has a token for every size and a size for every token", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const declared = [...css.matchAll(/^\s*--text-([a-z]+):/gm)].map((m) => m[1]);
    expect([...declared].sort()).toEqual([...typeScale].sort());
  });
});
