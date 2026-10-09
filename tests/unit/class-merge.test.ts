import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cn, typeScale } from "../../src/lib/utils";

// A size from the type scale and a text colour are both "text-" plus a word,
// so the class merger will treat them as one group and drop one unless it is
// told the scale by name.

describe("class merging keeps type and colour apart", () => {
  it("keeps a text colour when a type size is merged after it", () => {
    expect(cn("text-primary-foreground", "text-title-sm")).toContain("text-primary-foreground");
    expect(cn("text-danger", "text-caption")).toContain("text-danger");
    expect(cn("text-muted-text", "text-body-sm")).toContain("text-muted-text");
  });

  it("keeps text-body, the secondary colour, next to text-body-md, the size", () => {
    const merged = cn("text-body", "text-body-md");
    expect(merged).toContain("text-body-md");
    expect(merged.split(" ")).toContain("text-body");
  });

  it("still lets one type size replace another", () => {
    const merged = cn("text-body-md", "text-title-page");
    expect(merged).toContain("text-title-page");
    expect(merged).not.toContain("text-body-md");
  });

  it("still lets one text colour replace another", () => {
    const merged = cn("text-body", "text-danger");
    expect(merged).toContain("text-danger");
    expect(merged).not.toContain("text-body");
  });
});

describe("the scale named in utils matches the one in globals.css", () => {
  it("has a token for every size and a size for every token", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    // Whole names such as display-xl. A modifier such as display-xl--line-height
    // has a double dash after the name, so the colon never follows it directly.
    const declared = [...css.matchAll(/^\s*--text-([a-z0-9]+(?:-[a-z0-9]+)*):/gm)].map((m) => m[1]);
    expect([...declared].sort()).toEqual([...typeScale].sort());
  });
});
