import { describe, expect, it } from "vitest";
import { filterOptions, searchKey } from "@/components/ui/search-select";

const options = ["Ba-ao", "Dawo (Pob.)", "Santo Niño", "Santa Cruz", "San Vicente", "Cawa-cawa (Pob.)"];

describe("searchKey", () => {
  it("ignores case, accents, hyphens, spaces and the (Pob.) suffix", () => {
    expect(searchKey("Santo Niño")).toBe("santonino");
    expect(searchKey("SANTO NINO")).toBe("santonino");
    expect(searchKey("Ba-ao")).toBe("baao");
    expect(searchKey("Dawo (Pob.)")).toBe("dawo");
    expect(searchKey("  Cawa-cawa (pob)  ")).toBe("cawacawa");
  });
});

describe("filterOptions", () => {
  it("keeps every option for an empty search", () => {
    expect(filterOptions(options, "")).toEqual(options);
    expect(filterOptions(options, "  ")).toEqual(options);
  });

  it("finds Santo Niño from santo nino and Ba-ao from baao", () => {
    expect(filterOptions(options, "santo nino")).toEqual(["Santo Niño"]);
    expect(filterOptions(options, "baao")).toEqual(["Ba-ao"]);
    expect(filterOptions(options, "Santo Niño")).toEqual(["Santo Niño"]);
  });

  it("matches anywhere in the name and keeps the list order", () => {
    expect(filterOptions(options, "san")).toEqual(["Santo Niño", "Santa Cruz", "San Vicente"]);
    expect(filterOptions(options, "cawa cawa")).toEqual(["Cawa-cawa (Pob.)"]);
  });

  it("does not match on the (Pob.) suffix", () => {
    expect(filterOptions(options, "pob")).toEqual([]);
    expect(filterOptions(options, "dawo (pob.)")).toEqual(["Dawo (Pob.)"]);
  });

  it("finds nothing for a name that is not there", () => {
    expect(filterOptions(options, "zzz")).toEqual([]);
  });
});
