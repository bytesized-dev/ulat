import { describe, expect, it } from "vitest";
import fixtureFile from "../../../seed/ai-fixtures.json";
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

  it("does not read a capital after a colon as a place", () => {
    expect(facts("Note: Boil water", "Reminder: Bring IDs.")).toEqual([]);
  });

  it("ends a sentence at a line break", () => {
    expect(facts("Water", "Bring a container\nOne per family\r\nBring IDs")).toEqual([]);
    expect(facts("Water", "Go to the container\nNear Plaza\nMeet at Pasil Church")).toEqual(["place:Plaza", "place:Pasil Church"]);
  });

  it("ends a name at Street and keeps Saint as the start of one", () => {
    expect(facts("Road", "Rizal St. Bring IDs.")).toEqual([]);
    expect(facts("Road", "Go to Rizal St. Bring IDs.")).toEqual(["place:Rizal St"]);
    expect(facts("Road", "Church of St. Peter is open.")).toEqual(["place:St. Peter"]);
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

  it("flags a time with a changed hour or minutes", () => {
    expect(findMissingFacts(english, { ...good, tl: good.tl.replace("3:00 PM", "4:00 PM") })).toEqual([
      { language: "tl", kind: "time", text: "3:00 PM" },
    ]);
    expect(findMissingFacts(english, { ...good, tl: good.tl.replace("3:00 PM", "3:30 ng hapon") })).toEqual([
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

describe("AM and PM", () => {
  const water = { headline: "Water at the town plaza", message: "3 to 5 PM. Bring a container." };

  it("passes the design example and the MOCK fixture", () => {
    expect(findMissingFacts(water, fixtureFile.translation)).toEqual([]);
    expect(findMissingFacts(water, { ceb: "Tubig sa plaza, 3 hangtod 5 sa hapon.", tl: "Tubig sa plaza, 3 hanggang 5 ng hapon." })).toEqual([]);
  });

  it("fails when the hour is changed from 5 to 6", () => {
    const missing = findMissingFacts(water, { ceb: "Tubig, 3 hangtod 6 sa hapon.", tl: "Tubig, 3 hanggang 5 ng hapon." });
    expect(missing).toEqual([{ language: "ceb", kind: "time", text: "5 PM" }]);
  });

  it("fails when the number before the hour is changed", () => {
    expect(findMissingFacts(water, { ceb: "Tubig, 4 hangtod 5 sa hapon.", tl: "Tubig, 3 hanggang 5 ng hapon." })).toEqual([
      { language: "ceb", kind: "number", text: "3" },
    ]);
  });

  it.each(["5 PM", "5 pm", "5PM", "5 p.m.", "5 sa hapon", "5 sa gabii", "5 ng hapon", "5 ng gabi", "5 Sa  Hapon"])("accepts %s for 5 PM", (written) => {
    expect(findMissingFacts({ headline: "Open", message: "Until 5 PM." }, { ceb: `Abli hangtod ${written}.`, tl: `Bukas hanggang ${written}.` })).toEqual([]);
  });

  it.each(["6 AM", "6 am", "6AM", "6 a.m.", "6 sa buntag", "6 sa kadlawon", "6 ng umaga"])("accepts %s for 6 AM", (written) => {
    expect(findMissingFacts({ headline: "Open", message: "From 6 AM." }, { ceb: `Abli gikan ${written}.`, tl: `Bukas mula ${written}.` })).toEqual([]);
  });

  it("does not accept the other half of the day", () => {
    expect(findMissingFacts({ headline: "Open", message: "Until 5 PM." }, { ceb: "Abli hangtod 5 sa buntag.", tl: "Bukas hanggang 5 AM." })).toHaveLength(2);
    expect(findMissingFacts({ headline: "Open", message: "From 6 AM." }, { ceb: "Abli gikan 6 sa hapon.", tl: "Bukas mula 6 PM." })).toHaveLength(2);
  });

  it("does not accept the hour inside a longer number", () => {
    expect(findMissingFacts({ headline: "Open", message: "Until 5 PM." }, { ceb: "hangtod 15 sa hapon", tl: "hanggang 5 sa hapon" })).toHaveLength(1);
  });

  it.each([
    ["3pm", "3 pm"],
    ["3 pm", "3pm"],
    ["3PM", "3 PM"],
    ["3 PM", "3PM"],
    ["3:00pm", "3:00 pm"],
    ["3:00 PM", "3:00PM"],
  ])("matches %s written as %s", (english, written) => {
    expect(findMissingFacts({ headline: "Open", message: `Open at ${english}.` }, { ceb: `Abli sa ${written}.`, tl: `Bukas sa ${written}.` })).toEqual([]);
  });

  it("still needs 24 hour times as written", () => {
    const base = { headline: "Boat", message: "Leaves at 15:00." };
    expect(findMissingFacts(base, { ceb: "Mularga sa 15:00.", tl: "Aalis sa 15:00." })).toEqual([]);
    expect(findMissingFacts(base, { ceb: "Mularga sa 3 sa hapon.", tl: "Aalis sa 15:00." })).toEqual([{ language: "ceb", kind: "time", text: "15:00" }]);
  });
});
