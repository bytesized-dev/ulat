import { X509Certificate } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db/client";
import { responders, settings } from "../../db/schema";
import type { HubStatus } from "../contracts";
import { formatDate, secondsUntil } from "../time";
import { formatBattery } from "./status";

// What the Kit setup page shows. SPEC section 1. The status comes from the same
// readHubStatus call behind GET /api/hub/status, and the rest is read from the
// hub's own files and database. A value the hub cannot read says so, and is
// never filled in. Server only.

/** "https://hub.example.ph/" becomes "hub.example.ph". */
export function addressHost(address: string): string {
  return address.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/+$/, "");
}

/** The address the poster prints. The hub_address setting wins, and HUB_DOMAIN is the fallback. */
export function readHubDomain(db: Db, env: string | undefined = process.env.HUB_DOMAIN): string | undefined {
  const saved = db.select({ value: settings.value }).from(settings).where(eq(settings.key, "hub_address")).get()?.value?.trim();
  return (saved ? addressHost(saved) : undefined) || env?.trim() || undefined;
}

/** The Wi-Fi name SPEC section 1 gives the router, used when the wifi_name setting is empty. */
export const DEFAULT_WIFI_NAME = "ULAT-HUB";

export type Tone = "success" | "warning" | "danger" | "primary" | "muted-soft";
export type SetupPill = { label: string; tone: Tone };

/* ---------- Certificate ---------- */

const EXPIRING_DAYS = 14;
const SECONDS_PER_DAY = 24 * 60 * 60;

export type Certificate = { state: "none" } | { state: "valid" | "expiring" | "expired"; expires: Date };

/** The certificate folder infra/start.sh uses. HUB_CERT_DIR changes it, like it does there. */
export function certDir(env: Record<string, string | undefined> = process.env, platform: NodeJS.Platform = process.platform): string {
  if (env.HUB_CERT_DIR) return env.HUB_CERT_DIR;
  return platform === "win32" ? join(env.ProgramData ?? "C:\\ProgramData", "ulat", "certs") : "/etc/ulat/certs";
}

/** The first certificate in fullchain.pem. A missing or unreadable file is "none". */
export function readCertificate(dir: string, now: Date = new Date()): Certificate {
  try {
    const cert = new X509Certificate(readFileSync(join(dir, "fullchain.pem")));
    const expires = new Date(cert.validTo);
    if (Number.isNaN(expires.getTime())) return { state: "none" };
    const left = secondsUntil(expires, now);
    if (left <= 0) return { state: "expired", expires };
    return { state: left < EXPIRING_DAYS * SECONDS_PER_DAY ? "expiring" : "valid", expires };
  } catch {
    return { state: "none" };
  }
}

/* ---------- Offline map ---------- */

/** SPEC section 8 and public/map/README.md. The map package is for one town. */
export const MAP_AREA = "Dapitan City";

const Barangays = z.object({ features: z.array(z.unknown()) });

export type MapPackage = { ready: boolean; barangays: number | null };

/** Whether the tiles and boundaries are in public/map, and how many barangays the boundaries hold. */
export function readMapPackage(mapDir: string = resolve("public/map")): MapPackage {
  let barangays: number | null = null;
  try {
    const parsed = Barangays.safeParse(JSON.parse(readFileSync(join(mapDir, "barangays.geojson"), "utf8")));
    if (parsed.success) barangays = parsed.data.features.length;
  } catch {
    // No boundaries file, or one that is not JSON. The card says so.
  }
  return { ready: existsSync(join(mapDir, "town.pmtiles")) && barangays !== null && barangays > 0, barangays };
}

/* ---------- Responders ---------- */

export type ResponderRow = { id: string; name: string; team: string | null };

/** Responders who are switched on, in name order. */
export function readActiveResponders(db: Db): ResponderRow[] {
  return db
    .select({ id: responders.id, name: responders.name, team: responders.team })
    .from(responders)
    .where(eq(responders.active, true))
    .orderBy(asc(responders.name))
    .all();
}

/* ---------- The page ---------- */

export type KitSetup = {
  network: { pill: SetupPill; wifi: string; phones: number; internet: string };
  address: { pill: SetupPill; domain: string; expires: string };
  map: { pill: SetupPill; area: string; barangays: number | null };
  ai: { pill: SetupPill; modelLoaded: boolean };
  power: { pill: SetupPill; battery: string; storageFree: string };
  responders: { pill: SetupPill; rows: ResponderRow[]; total: number };
  simulation: boolean;
  /** The Kit now rail of the checklist page. */
  kitNow: { internet: string; map: string; ai: string; certificate: string; battery: string };
};

export type SetupInputs = {
  status: HubStatus;
  certificate: Certificate;
  domain: string | undefined;
  map: MapPackage;
  responders: ResponderRow[];
  /** The wifi_name setting, as the overview reads it. */
  wifiName?: string;
};

/** Turns what the hub read into the cards. Pure, so a test can hand it any state. */
export function buildKitSetup({ status, certificate, domain, map, responders, wifiName }: SetupInputs): KitSetup {
  const address: SetupPill =
    certificate.state === "valid"
      ? { label: "Trusted", tone: "success" }
      : certificate.state === "expiring"
        ? { label: "Expires soon", tone: "warning" }
        : certificate.state === "expired"
          ? { label: "Expired", tone: "danger" }
          : { label: "No certificate", tone: "warning" };

  const mapPill: SetupPill = map.ready ? { label: "Ready", tone: "success" } : { label: "Missing", tone: "danger" };

  return {
    network: {
      pill: status.phones > 0 ? { label: "Working", tone: "success" } : { label: "No phones", tone: "muted-soft" },
      wifi: wifiName?.trim() || DEFAULT_WIFI_NAME,
      phones: status.phones,
      internet: status.internet ? "Connected" : "None",
    },
    address: {
      pill: address,
      domain: domain?.trim() || "Not set",
      expires: certificate.state === "none" ? "Unknown" : formatDate(certificate.expires),
    },
    map: { pill: mapPill, area: MAP_AREA, barangays: map.barangays },
    ai: {
      pill: status.model_loaded ? { label: "Loaded", tone: "success" } : { label: "Not loaded", tone: "danger" },
      modelLoaded: status.model_loaded,
    },
    power: {
      pill:
        status.charging === true
          ? { label: "Charging", tone: "success" }
          : status.charging === false
            ? { label: "On battery", tone: "warning" }
            : { label: "Unknown", tone: "muted-soft" },
      battery: formatBattery(status.battery_percent),
      storageFree: typeof status.storage_free_gb === "number" ? `${status.storage_free_gb} GB` : "Unknown",
    },
    responders: {
      pill: { label: `${responders.length} active`, tone: "primary" },
      rows: responders,
      total: responders.length,
    },
    simulation: status.simulation,
    kitNow: {
      internet: status.internet ? "Connected" : "None",
      map: map.ready ? "Ready" : "Missing",
      ai: status.model_loaded ? "Loaded" : "Not loaded",
      certificate:
        certificate.state === "valid" ? "Valid" : certificate.state === "expiring" ? "Expires soon" : certificate.state === "expired" ? "Expired" : "None",
      battery: formatBattery(status.battery_percent),
    },
  };
}

/** Reads the hub and builds the cards. status is the readHubStatus result, the same one GET /api/hub/status sends. */
export function readKitSetup(db: Db, status: HubStatus, wifiName?: string, now: Date = new Date()): KitSetup {
  return buildKitSetup({
    status,
    certificate: readCertificate(certDir(), now),
    domain: readHubDomain(db),
    map: readMapPackage(),
    responders: readActiveResponders(db),
    wifiName,
  });
}
