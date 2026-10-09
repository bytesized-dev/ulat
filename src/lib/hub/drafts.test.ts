import { describe, expect, it } from "vitest";
import { editDraft, emptyDraft, mergeDraft } from "./drafts";

describe("mergeDraft", () => {
  it("fills an empty field", () => {
    expect(mergeDraft(emptyDraft, "Tubig sa plaza")).toEqual({ text: "Tubig sa plaza", fromAi: true });
    expect(mergeDraft(editDraft("   "), "Tubig sa plaza")).toEqual({ text: "Tubig sa plaza", fromAi: true });
  });

  it("replaces a draft nobody touched", () => {
    expect(mergeDraft({ text: "Old draft", fromAi: true }, "New draft")).toEqual({ text: "New draft", fromAi: true });
  });

  it("never overwrites what staff typed", () => {
    const typed = editDraft("Tubig sa plaza, alas 3");
    expect(mergeDraft(typed, "New draft")).toBe(typed);
  });
});
