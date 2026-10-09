import { describe, expect, it } from "vitest";
import { barangayError, buildForm, buildMeta, formatDuration, gpsText, nextLabel, sendError } from "./capture";

const house = { report_code: "K7P4", barangay: "Dapitan", purok: "Purok 2", household_head: "Maria Santos" };

describe("capture helpers", () => {
  it("labels photos Front, Roof, Damage and then stops", () => {
    expect([0, 1, 2, 3].map(nextLabel)).toEqual(["Front", "Roof", "Damage", null]);
  });

  it("formats the note length and caps it at 30 seconds", () => {
    expect(formatDuration(22.9)).toBe("0:22");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(99)).toBe("0:30");
    expect(formatDuration(-1)).toBe("0:00");
  });

  it("shows the GPS accuracy in whole metres", () => {
    expect(gpsText({ lat: 1, lng: 2, accuracy_m: 12.4 }, false)).toBe("GPS saved, 12 m");
    expect(gpsText(null, true)).toMatch(/not available/);
  });

  it("builds meta that passes the contract, with and without GPS", () => {
    const withGps = buildMeta(house, ["Front"], { lat: 9.77, lng: 123.3, accuracy_m: 12 });
    expect(withGps.success && withGps.data.gps_accuracy_m).toBe(12);
    const without = buildMeta(house, ["Front"], null);
    expect(without.success && without.data.lat).toBeNull();
  });

  it("rejects meta with more than three labels or no barangay", () => {
    expect(buildMeta(house, ["a", "b", "c", "d"], null).success).toBe(false);
    expect(buildMeta({ ...house, barangay: "" }, ["a"], null).success).toBe(false);
  });

  it("builds the multipart body", () => {
    const meta = buildMeta(house, ["Front"], null);
    if (!meta.success) throw new Error("meta");
    const photo = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const form = buildForm(meta.data, [photo], new Blob(["y"], { type: "audio/webm;codecs=opus" }));
    expect(form.getAll("photos")).toHaveLength(1);
    expect((form.get("note") as File).name).toBe("note.webm");
    expect(JSON.parse(String(form.get("meta"))).report_code).toBe("K7P4");
  });

  it("maps API errors to short messages", () => {
    expect(sendError(401, undefined)).toMatch(/Sign in/);
    expect(sendError(400, "photo_count")).toMatch(/one to three/);
    expect(sendError(400, "audio_size_not_allowed")).toMatch(/too big/);
    expect(sendError(500, undefined)).toMatch(/Try again/);
  });
});

describe("barangayError", () => {
  const listed = ["Sinonoc", "Dawo (Pob.)"];

  it("asks for a barangay when a new house has none", () => {
    expect(barangayError("", listed)).toBe("Choose a barangay");
  });

  it("asks again for a barangay the hub no longer lists", () => {
    expect(barangayError("Gone", listed)).toBe("Choose a barangay");
  });

  it("accepts a listed barangay", () => {
    expect(barangayError("Dawo (Pob.)", listed)).toBeNull();
  });
});
