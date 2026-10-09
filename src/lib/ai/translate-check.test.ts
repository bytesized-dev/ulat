import { describe, expect, it } from "vitest";
import { extractFacts, findMissingFacts } from "./translate-check";

const facts = (headline: string, message: string) =>
  extractFacts({ headline, message }).map((fact) => `${fact.kind}:${fact.text}`);

describe("extractFacts", () => {
  it("pulls out times, numbers and places", () => {
    expect(facts("Water at the plaza", "Bring a container. One per family at Barangay Pasil, 3:00 PM to 5:00 PM.")).toEqual([
      "time:3:00 PM",
      "time:5:00 PM",
      "place:Barangay Pasil",
    ]);
  });

  it("reads 24 hour times and bare PM times as times, not numbers", () => {
    expect(facts("Boats leave at 15:00", "Next boat at 5 PM and 6 a.m.")).toEqual([
      "time:15:00",
      "time:5 PM",
      "time:6 a.m.",
    ]);
  });

  it("keeps decimals and thousands separators whole", () => {
    expect(facts("Rain", "Expect 2.5 meters of water. 1,200 families are affected.")).toEqual([
      "number:2.5",
      "number:1,200",
    ]);
  });

  it("skips the first word of a sentence, days and months", () => {
    expect(facts("Relief goods", "Distribution starts Monday. Pickup at Plaza on October 9.")).toEqual(["number:9", "place:Plaza"]);
  });

  it("keeps an abbreviation inside a place name", () => {
    expect(facts("Shelter open", "Go to Sto. Niño Gym, near Pasil Church.")).toEqual(["place:Sto. Niño Gym", "place:Pasil Church"]);
  });

  it("splits places at commas", () => {
    expect(facts("Road closed", "Between Pasil, Labangon and Ermita.")).toEqual(["place:Pasil", "place:Labangon", "place:Ermita"]);
  });

  it("reads sentence case headlines, where only the first word is skipped", () => {
    expect(facts("Upper San Isidro road blocked", "Visits start in San Isidro.")).toEqual(["place:San Isidro"]);
  });

  it("lists a repeated fact once", () => {
    expect(facts("Plaza at 3 PM", "Meet at the Plaza at 3 PM.")).toEqual(["time:3 PM", "place:Plaza"]);
  });

  it("finds nothing in a plain note", () => {
    expect(facts("Stay calm", "Listen to the radio for updates.")).toEqual([]);
  });
});

describe("findMissingFacts", () => {
  const english = { headline: "Water at the plaza", message: "Bring a container. 1 per family at Barangay Pasil, 3:00 PM to 5:00 PM." };
  const good = {
    ceb: "Tubig sa plaza. Pagdala og sudlanan. 1 matag pamilya sa Barangay Pasil, 3:00 PM hangtod 5:00 PM.",
    tl: "Tubig sa plaza. Magdala ng lalagyan. 1 bawat pamilya sa Barangay Pasil, 3:00 PM hanggang 5:00 PM.",
  };

  it("returns nothing when both drafts keep every fact", () => {
    expect(findMissingFacts(english, good)).toEqual([]);
  });

  it("ignores case and spacing", () => {
    expect(findMissingFacts(english, { ...good, tl: good.tl.replace("3:00 PM", "3:00pm").replace("Barangay Pasil", "barangay  pasil") })).toEqual([]);
  });

  it("names the language and the fact that went missing", () => {
    const missing = findMissingFacts(english, { ...good, ceb: good.ceb.replace("5:00 PM", "alas singko") });
    expect(missing).toEqual([{ language: "ceb", kind: "time", text: "5:00 PM" }]);
  });

  it("flags a time written another way", () => {
    expect(findMissingFacts(english, { ...good, tl: good.tl.replace("3:00 PM", "3:00 ng hapon") })).toEqual([
      { language: "tl", kind: "time", text: "3:00 PM" },
    ]);
  });

  it("flags a changed number and does not match inside a longer one", () => {
    const base = { headline: "Rice", message: "Take 3 sacks." };
    expect(findMissingFacts(base, { ceb: "Kuha og 3 sako.", tl: "Kumuha ng 13 sako." })).toEqual([
      { language: "tl", kind: "number", text: "3" },
    ]);
    expect(findMissingFacts(base, { ceb: "Kuha og 3.5 sako.", tl: "Kumuha ng 3 sako." })).toEqual([
      { language: "ceb", kind: "number", text: "3" },
    ]);
  });

  it("flags a translated or misspelled place", () => {
    const missing = findMissingFacts(english, { ...good, tl: good.tl.replace("Barangay Pasil", "Barangay Pasig") });
    expect(missing).toEqual([{ language: "tl", kind: "place", text: "Barangay Pasil" }]);
  });

  it("does not match a place inside a longer word", () => {
    const base = { headline: "Meet", message: "We meet at Pasil." };
    expect(findMissingFacts(base, { ceb: "Magkita sa Pasil.", tl: "Magkita sa Pasilan." })).toEqual([
      { language: "tl", kind: "place", text: "Pasil" },
    ]);
  });

  it("flags every fact when a draft is empty", () => {
    expect(findMissingFacts(english, { ...good, tl: "" }).map((fact) => fact.text)).toEqual(["3:00 PM", "5:00 PM", "1", "Barangay Pasil"]);
  });
});
