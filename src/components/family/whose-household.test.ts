import { describe, expect, it } from "vitest";
import { emptyDraft } from "./report-draft";
import { firstMissing } from "./whose-household";

const barangays = ["Sinonoc", "Dawo (Pob.)"];
const family = { ...emptyDraft(), household_head: "Dela Cruz", barangay: "Sinonoc" };
const neighbor = { ...family, source: "neighbor" as const, reporter_name: "Joy" };

describe("firstMissing", () => {
  it("lets a complete household continue", () => {
    expect(firstMissing(family, barangays)).toBeNull();
    expect(firstMissing(neighbor, barangays)).toBeNull();
  });

  it("asks for the head of household first on My household", () => {
    expect(firstMissing(emptyDraft(), barangays)).toEqual({ field: "household_head", message: "Enter the head of household" });
    expect(firstMissing({ ...family, household_head: "  " }, barangays)?.field).toBe("household_head");
  });

  it("asks for the barangay next, and not for a name the family does not give", () => {
    expect(firstMissing({ ...family, barangay: "" }, barangays)).toEqual({ field: "barangay", message: "Choose a barangay" });
    expect(firstMissing({ ...family, reporter_name: "" }, barangays)).toBeNull();
  });

  it("does not count a barangay that is no longer on the hub's list", () => {
    expect(firstMissing({ ...family, barangay: "Gone" }, barangays)?.field).toBe("barangay");
    expect(firstMissing(family, [])?.field).toBe("barangay");
  });

  it("asks a neighbor's report for the neighbor's name, the barangay, then the reporter's name", () => {
    expect(firstMissing({ ...neighbor, household_head: "", barangay: "", reporter_name: "" }, barangays)).toEqual({ field: "household_head", message: "Enter the neighbor's name" });
    expect(firstMissing({ ...neighbor, barangay: "", reporter_name: "" }, barangays)?.field).toBe("barangay");
    expect(firstMissing({ ...neighbor, reporter_name: " " }, barangays)).toEqual({ field: "reporter_name", message: "Enter your name" });
  });

  it("never needs where to find the reporter", () => {
    expect(firstMissing({ ...neighbor, reporter_where: "" }, barangays)).toBeNull();
  });
});
