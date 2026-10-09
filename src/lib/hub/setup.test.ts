import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HubStatus } from "../contracts";
import type { Db } from "../../db/client";
import { formatCount, formatRate, formatSeconds, modelLabel } from "./kit-format";
import { buildKitSetup, certDir, readActiveResponders, readCertificate, readMapPackage, type SetupInputs } from "./setup";
import { freshDb } from "./test-setup";

const dir = mkdtempSync(join(tmpdir(), "ulat-setup-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// A throwaway self-signed certificate for hub.test that ends on 15 Sep 2126.
// The tests move "now" around it, so none of them depends on today's date.
const CERT = `-----BEGIN CERTIFICATE-----
MIIBXTCCAQKgAwIBAgIUeHq+5sKxPwR08d1yP4LCKrHCtdQwCgYIKoZIzj0EAwIw
EzERMA8GA1UEAwwIaHViLnRlc3QwIBcNMjYxMDA5MTU1NzU2WhgPMjEyNjA5MTUx
NTU3NTZaMBMxETAPBgNVBAMMCGh1Yi50ZXN0MFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAEhnelEshpbQURcIBudFqKIoVji7oPYXH4Q46lXH4sMv+qg7//0UDq6Lr1
+Uswvayw/rbsEIF+PQ+65quFQomtOKMyMDAwHQYDVR0OBBYEFHptqXCZVYoUQjdW
+MxJiF5+Kwk3MA8GA1UdEwEB/wQFMAMBAf8wCgYIKoZIzj0EAwIDSQAwRgIhALnm
jBAmSdzlgTxItZEaIHFWfbQI+EFDUmk9Bg/rgEyEAiEAxwhNuFKnM4hJpGGgE10r
eYCdIu7fsxLFBd4ISplTLRw=
-----END CERTIFICATE-----
`;
const ENDS = new Date("2126-09-15T15:57:56Z");
const DAY = 24 * 60 * 60 * 1000;

function certFolder(name: string, pem = CERT): string {
  const folder = join(dir, name);
  mkdirSync(folder);
  writeFileSync(join(folder, "fullchain.pem"), pem);
  return folder;
}

describe("readCertificate", () => {
  it("is valid with plenty of time left", () => {
    const cert = readCertificate(certFolder("valid"), new Date(ENDS.getTime() - 60 * DAY));
    expect(cert.state).toBe("valid");
    expect(cert.state !== "none" && cert.expires.toISOString()).toBe("2126-09-15T15:57:56.000Z");
  });

  it("is expiring inside 14 days", () => {
    expect(readCertificate(certFolder("expiring"), new Date(ENDS.getTime() - 5 * DAY)).state).toBe("expiring");
  });

  it("is expired after its end date", () => {
    expect(readCertificate(certFolder("expired"), new Date(ENDS.getTime() + DAY)).state).toBe("expired");
  });

  it("is none when the folder has no certificate", () => {
    expect(readCertificate(join(dir, "nowhere"))).toEqual({ state: "none" });
  });

  it("is none when the file is not a certificate", () => {
    expect(readCertificate(certFolder("junk", "not a certificate"))).toEqual({ state: "none" });
  });
});

describe("certDir", () => {
  it("follows infra/start.sh", () => {
    expect(certDir({}, "darwin")).toBe("/etc/ulat/certs");
    expect(certDir({ HUB_CERT_DIR: "/my/certs" }, "darwin")).toBe("/my/certs");
  });

  it("follows infra/start.ps1 on Windows", () => {
    expect(certDir({ ProgramData: "D:\\Data" }, "win32")).toContain("ulat");
  });
});

describe("readMapPackage", () => {
  function mapFolder(name: string, files: Record<string, string>): string {
    const folder = join(dir, name);
    mkdirSync(folder);
    for (const [file, content] of Object.entries(files)) writeFileSync(join(folder, file), content);
    return folder;
  }
  const boundaries = JSON.stringify({ features: [{}, {}, {}] });

  it("is ready with the tiles and the boundaries, and counts the barangays", () => {
    expect(readMapPackage(mapFolder("map-ok", { "town.pmtiles": "x", "barangays.geojson": boundaries }))).toEqual({ ready: true, barangays: 3 });
  });

  it("is not ready without the tiles", () => {
    expect(readMapPackage(mapFolder("map-no-tiles", { "barangays.geojson": boundaries }))).toEqual({ ready: false, barangays: 3 });
  });

  it("is not ready without the boundaries", () => {
    expect(readMapPackage(mapFolder("map-no-boundaries", { "town.pmtiles": "x" }))).toEqual({ ready: false, barangays: null });
  });

  it("is not ready when the boundaries are broken", () => {
    expect(readMapPackage(mapFolder("map-broken", { "town.pmtiles": "x", "barangays.geojson": "{" }))).toEqual({ ready: false, barangays: null });
    expect(readMapPackage(mapFolder("map-shape", { "town.pmtiles": "x", "barangays.geojson": "[]" }))).toEqual({ ready: false, barangays: null });
  });

  it("reads the real public/map folder", () => {
    expect(readMapPackage()).toMatchObject({ ready: true, barangays: 50 });
  });
});

describe("readActiveResponders", () => {
  let db: Db;
  beforeAll(async () => {
    const fresh = await freshDb("setup-responders");
    db = fresh.db;
    db.insert(fresh.schema.responders)
      .values([
        { name: "Mae Santos", team: "San Isidro", active: true },
        { name: "Carlo Mendoza", team: null, active: true },
        { name: "Jun Reyes", team: "San Isidro", active: false },
      ])
      .run();
  });

  it("lists responders who are on, by name, and leaves out the ones switched off", () => {
    expect(readActiveResponders(db).map((r) => [r.name, r.team])).toEqual([
      ["Carlo Mendoza", null],
      ["Mae Santos", "San Isidro"],
    ]);
  });
});

const status: HubStatus = {
  internet: false,
  phones: 9,
  battery_percent: 68,
  charging: false,
  model_loaded: true,
  storage_free_gb: 120.5,
  simulation: true,
};

const inputs = (over: Partial<SetupInputs> = {}): SetupInputs => ({
  status,
  certificate: { state: "valid", expires: new Date("2027-01-07T00:00:00Z") },
  domain: "hub.example.dev",
  map: { ready: true, barangays: 50 },
  responders: [{ id: "1", name: "Mae Santos", team: "San Isidro" }],
  ...over,
});

describe("buildKitSetup", () => {
  it("shows the status it was given and nothing else", () => {
    const kit = buildKitSetup(inputs());
    expect(kit.network).toEqual({ pill: { label: "Working", tone: "success" }, wifi: "ULAT-HUB", phones: 9, internet: "None" });
  });

  it("shows the wifi_name setting, and ULAT-HUB when it is empty", () => {
    expect(buildKitSetup(inputs({ wifiName: "ULAT-DRILL" })).network.wifi).toBe("ULAT-DRILL");
    expect(buildKitSetup(inputs({ wifiName: "  " })).network.wifi).toBe("ULAT-HUB");
  });

  it("builds the other cards from the status", () => {
    const kit = buildKitSetup(inputs());
    expect(kit.power).toEqual({ pill: { label: "On battery", tone: "warning" }, battery: "68%", storageFree: "120.5 GB" });
    expect(kit.ai.pill).toEqual({ label: "Loaded", tone: "success" });
    expect(kit.address).toEqual({ pill: { label: "Trusted", tone: "success" }, domain: "hub.example.dev", expires: "7 Jan 2027" });
    expect(kit.map).toEqual({ pill: { label: "Ready", tone: "success" }, area: "Dapitan City", barangays: 50 });
    expect(kit.responders).toMatchObject({ pill: { label: "1 active", tone: "primary" }, total: 1 });
    expect(kit.simulation).toBe(true);
    expect(kit.kitNow).toEqual({ internet: "None", map: "Ready", ai: "Loaded", certificate: "Valid", battery: "68%" });
  });

  it("says Connected when the internet probe is true", () => {
    expect(buildKitSetup(inputs({ status: { ...status, internet: true } })).network.internet).toBe("Connected");
  });

  it("marks a hub with no phones and no battery reading as such, without inventing numbers", () => {
    const kit = buildKitSetup(inputs({ status: { ...status, phones: 0, battery_percent: null, charging: null, storage_free_gb: null } }));
    expect(kit.network.pill).toEqual({ label: "No phones", tone: "muted-soft" });
    expect(kit.power).toEqual({ pill: { label: "Unknown", tone: "muted-soft" }, battery: "Unknown", storageFree: "Unknown" });
  });

  it("says charging when the hub is plugged in", () => {
    expect(buildKitSetup(inputs({ status: { ...status, charging: true } })).power.pill).toEqual({ label: "Charging", tone: "success" });
  });

  it("shows a model that is not loaded as a problem", () => {
    const kit = buildKitSetup(inputs({ status: { ...status, model_loaded: false } }));
    expect(kit.ai.pill).toEqual({ label: "Not loaded", tone: "danger" });
    expect(kit.kitNow.ai).toBe("Not loaded");
  });

  it("shows each certificate state", () => {
    const expires = new Date("2027-01-07T00:00:00Z");
    expect(buildKitSetup(inputs({ certificate: { state: "expiring", expires } })).address.pill).toEqual({ label: "Expires soon", tone: "warning" });
    expect(buildKitSetup(inputs({ certificate: { state: "expired", expires } })).address.pill).toEqual({ label: "Expired", tone: "danger" });
    const none = buildKitSetup(inputs({ certificate: { state: "none" }, domain: undefined }));
    expect(none.address).toEqual({ pill: { label: "No certificate", tone: "warning" }, domain: "Not set", expires: "Unknown" });
    expect(none.kitNow.certificate).toBe("None");
  });

  it("shows a map that is missing files", () => {
    const kit = buildKitSetup(inputs({ map: { ready: false, barangays: null } }));
    expect(kit.map.pill).toEqual({ label: "Missing", tone: "danger" });
    expect(kit.kitNow.map).toBe("Missing");
  });

  it("counts the responders it is given", () => {
    expect(buildKitSetup(inputs({ responders: [] })).responders).toMatchObject({ pill: { label: "0 active" }, total: 0 });
  });
});

describe("kit format helpers", () => {
  it("names the model", () => {
    expect(modelLabel("gemma4:e4b")).toBe("Gemma 4 E4B");
    expect(modelLabel("llama3")).toBe("llama3");
  });

  it("rounds rates and seconds for display and gives n/a for nothing", () => {
    expect(formatRate(0.8)).toBe("80%");
    expect(formatRate(0.8667)).toBe("87%");
    expect(formatRate(null)).toBe("n/a");
    expect(formatSeconds(4.14)).toBe("4.1");
    expect(formatSeconds(null)).toBe("n/a");
    expect(formatCount(800)).toBe("800");
    expect(formatCount(undefined)).toBe("n/a");
  });
});
