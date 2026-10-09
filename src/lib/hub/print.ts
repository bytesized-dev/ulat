import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import type { Db } from "../../db/client";
import { settings } from "../../db/schema";
import { DEFAULT_WIFI_NAME } from "./setup";
import { getHazardLines, getSitrep, isSimulationSitrep, readTown, type Sitrep } from "./sitreps";

// BYTE-43. What the two print pages read. Callers pass the database so tests
// can use their own file. Nothing here counts: the report numbers come from the
// saved snapshot, and the poster only shows settings.

function readText(db: Db, key: string): string | undefined {
  return db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get()?.value?.trim() || undefined;
}

export type PrintReport = {
  sitrep: Sitrep;
  town: string;
  /** From the saved report, never the live setting. */
  simulation: boolean;
  /** One line per hazard, read live because the snapshot has no hazards. */
  hazards: string[];
  /** When the hazards were read, as an ISO time. */
  hazardsReadAt: string;
};

/**
 * The report for /hub/reports/[n]/print, or null when `n` is not the number of
 * a saved report. The page answers null with a 404.
 */
export function getPrintReport(db: Db, n: string, at: Date = new Date()): PrintReport | null {
  if (!/^[1-9]\d*$/.test(n)) return null;
  const sitrep = getSitrep(db, Number(n));
  if (!sitrep) return null;
  return {
    sitrep,
    town: readTown(db),
    simulation: isSimulationSitrep(sitrep),
    hazards: getHazardLines(db),
    hazardsReadAt: at.toISOString(),
  };
}

export type PosterData = {
  town: string;
  wifiName: string;
  /** The address the QR code encodes, exactly as saved in the hub_address setting. */
  hubAddress: string | null;
  /** The address without its scheme, for the line people can type. */
  hubHost: string | null;
};

/** "https://hub.example.ph/" becomes "hub.example.ph". */
export function addressHost(address: string): string {
  return address.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/+$/, "");
}

export function readPoster(db: Db): PosterData {
  const hubAddress = readText(db, "hub_address") ?? null;
  return {
    town: readTown(db),
    wifiName: readText(db, "wifi_name") ?? DEFAULT_WIFI_NAME,
    hubAddress,
    hubHost: hubAddress ? addressHost(hubAddress) : null,
  };
}

/** Empty cells around the code that a scanner needs, from the QR spec. */
export const QR_QUIET_ZONE = 4;

/** The QR code as one SVG path in a grid of `size` by `size` cells, one cell per unit. */
export function qrPath(text: string): { size: number; d: string } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = modules.size;
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, d };
}

/** "Landslide on upper San Isidro road" becomes "Landslide on upper San Isidro road." */
export function hazardSentence(lines: string[]): string {
  return lines.map((h) => (h.endsWith(".") ? h : `${h}.`)).join(" ");
}
