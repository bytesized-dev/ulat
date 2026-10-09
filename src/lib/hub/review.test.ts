import { describe, expect, it } from "vitest";
import { REVIEW_REASONS } from "@/app/api/entries/_lib/review";
import { aiSide, reasonLabels, reasonTone, responderCounts, responderSide } from "./review";

describe("reason text", () => {
  it("shortens the sentences the entries route stores", () => {
    expect(reasonLabels(REVIEW_REASONS.class_differs)).toEqual(["Responder changed class"]);
    expect(reasonLabels(REVIEW_REASONS.unclear_no_new_photo)).toEqual(["AI not sure"]);
    expect(reasonLabels(REVIEW_REASONS.hurt_differs)).toEqual(["Hurt count differs"]);
  });

  it("gives every reason when the route stored several", () => {
    const stored = `${REVIEW_REASONS.class_differs} ${REVIEW_REASONS.hurt_differs}`;
    expect(reasonLabels(stored)).toEqual(["Responder changed class", "Hurt count differs"]);
  });

  it("shows a short label as it is", () => {
    expect(reasonLabels("AI not sure")).toEqual(["AI not sure"]);
  });

  it("says something when no reason was stored", () => {
    expect(reasonLabels(null)).toEqual(["Needs a second look"]);
    expect(reasonLabels("  ")).toEqual(["Needs a second look"]);
  });

  it("marks a hurt count that differs as the urgent one", () => {
    expect(reasonTone("Hurt count differs")).toBe("danger");
    expect(reasonTone("AI not sure")).toBe("muted-soft");
    expect(reasonTone("Responder changed class")).toBe("warning");
  });
});

describe("the two sides", () => {
  it("shows the AI class and its reason", () => {
    expect(aiSide({ ai_class: "partial", ai_reason: "Roof partly missing on the left.", ai_need_more: null })).toEqual({
      label: "Partially damaged",
      tone: "warning",
      text: "Roof partly missing on the left.",
    });
  });

  it("shows what the AI wanted when it was not sure", () => {
    const side = aiSide({ ai_class: "unclear", ai_reason: "The roof is not visible.", ai_need_more: "Roof from the side" });
    expect(side).toMatchObject({ label: "Not sure", tone: "muted-soft", text: "Roof from the side" });
    expect(aiSide({ ai_class: "unclear", ai_reason: "The roof is not visible.", ai_need_more: null }).text).toBe("The roof is not visible.");
  });

  it("says so when the AI never drafted", () => {
    expect(aiSide({ ai_class: null, ai_reason: null, ai_need_more: null }).label).toBe("No AI draft");
  });

  it("shows the responder's class and note", () => {
    expect(responderSide({ damage_class: "total", note: "Back half collapsed." })).toEqual({
      label: "Totally damaged",
      tone: "danger",
      text: "Back half collapsed.",
    });
  });

  it("says No note when the responder wrote none", () => {
    expect(responderSide({ damage_class: "partial", note: null }).text).toBe("No note.");
  });
});

describe("the counts a review is about", () => {
  const counts = { people: 5, hurt: 2, missing: 0, report_people: 5, report_hurt: 1, report_missing: 0, review_reason: "Hurt count differs" };
  const rows = (c: Parameters<typeof responderCounts>[0]) => responderCounts(c).map((l) => [l.label, l.value]);

  it("shows the responder's hurt count beside the family report's when the reason is a hurt count that differs", () => {
    expect(rows(counts)).toEqual([["Hurt", "2"], ["Family report, hurt", "1"]]);
  });

  it("reads the long reason the entries route stores", () => {
    const stored = { ...counts, review_reason: "The hurt count is different from the family report." };
    expect(rows(stored)).toEqual([["Hurt", "2"], ["Family report, hurt", "1"]]);
  });

  it("still shows the hurt count when no family report is linked, and says so", () => {
    const unlinked = { ...counts, report_people: null, report_hurt: null, report_missing: null };
    expect(rows(unlinked)).toEqual([["Hurt", "2"], ["Family report, hurt", "Not linked"]]);
  });

  it("adds people or missing when they differ from the family report", () => {
    const more = { ...counts, report_people: 4, report_missing: 1 };
    expect(rows(more)).toEqual([
      ["People", "5"], ["Family report, people", "4"],
      ["Hurt", "2"], ["Family report, hurt", "1"],
      ["Missing", "0"], ["Family report, missing", "1"],
    ]);
  });

  it("shows no counts when the reason is about the class", () => {
    expect(rows({ ...counts, report_hurt: 2, review_reason: "Responder changed class" })).toEqual([]);
  });
});
