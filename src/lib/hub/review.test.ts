import { describe, expect, it } from "vitest";
import { REVIEW_REASONS } from "@/app/api/entries/_lib/review";
import { EntryConfirm } from "../contracts/schemas";
import { reasonLabels, reasonTone, responderCounts, responderSide, reviewActions, type ReviewEntry } from "./review";

describe("reason text", () => {
  it("shortens the sentence the entries route stores", () => {
    expect(reasonLabels(REVIEW_REASONS.hurt_differs)).toEqual(["Hurt count differs"]);
  });

  it("shows any other stored text as it is", () => {
    expect(reasonLabels("Hurt count differs")).toEqual(["Hurt count differs"]);
  });

  it("says something when no reason was stored", () => {
    expect(reasonLabels(null)).toEqual(["Needs a second look"]);
    expect(reasonLabels("  ")).toEqual(["Needs a second look"]);
  });

  it("marks a hurt count that differs as the urgent one", () => {
    expect(reasonTone("Hurt count differs")).toBe("danger");
    expect(reasonTone("Needs a second look")).toBe("warning");
  });
});

describe("the responder side", () => {
  it("shows the responder's class and says when they left a voice note", () => {
    expect(responderSide({ damage_class: "total", note: "Left a voice note." })).toEqual({
      label: "Totally damaged",
      tone: "danger",
      text: "Left a voice note.",
    });
  });

  it("says No note when the responder left none", () => {
    expect(responderSide({ damage_class: "partial", note: null }).text).toBe("No note.");
  });
});

describe("the counts a review is about", () => {
  const counts = { people: 5, hurt: 2, missing: 0, report_people: 5, report_hurt: 1, report_missing: 0, review_reason: "Hurt count differs" };
  const rows = (c: Parameters<typeof responderCounts>[0]) => responderCounts(c).map((l) => [l.label, l.value]);

  it("shows the responder's hurt count beside the family report's", () => {
    expect(rows(counts)).toEqual([["Hurt", "2"], ["Family report, hurt", "1"]]);
  });

  it("reads the long reason the entries route stores", () => {
    const stored = { ...counts, review_reason: REVIEW_REASONS.hurt_differs };
    expect(rows(stored)).toEqual([["Hurt", "2"], ["Family report, hurt", "1"]]);
  });

  it("adds people or missing when they differ from the family report", () => {
    const more = { ...counts, report_people: 4, report_missing: 1 };
    expect(rows(more)).toEqual([
      ["People", "5"], ["Family report, people", "4"],
      ["Hurt", "2"], ["Family report, hurt", "1"],
      ["Missing", "0"], ["Family report, missing", "1"],
    ]);
  });
});

describe("review actions", () => {
  const confirm = { damage_class: "total", material: "light", hazards: [], families: 1, people: 4, hurt: 0, missing: 0, needs: ["water"] } as const;
  const entry = { damage_class: "total", confirm } as unknown as ReviewEntry;

  it("approves the responder's own class and values, with no AI class to choose", () => {
    const actions = reviewActions(entry);
    expect(Object.keys(actions)).toEqual(["approve"]);
    expect(actions.approve?.label).toBe("Approve totally damaged");
    expect(EntryConfirm.parse(actions.approve?.body)).toEqual({ ...confirm, needs: ["water"] });
  });
});
