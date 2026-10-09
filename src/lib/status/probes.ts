import { execFile } from "node:child_process";
import { Resolver } from "node:dns/promises";
import { statfs } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { OLLAMA_MODEL, ollamaUrl } from "@/lib/ai/config";
import { databasePath } from "@/db/path";

// One function per field of HubStatus. None of them throws: a machine with no
// pmset, no Ollama or no network gets null or false, so the hub still runs on
// a Windows laptop or with the Wi-Fi unplugged.

const PROBE_TIMEOUT_MS = 1500;

/**
 * The promise's result, or a rejection after ms. The timer is unref'd and
 * cleared, and onTimeout lets the caller cancel the work that lost the race.
 */
function within<T>(promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, fail) => {
    timer = setTimeout(() => {
      onTimeout?.();
      fail(new Error("probe timeout"));
    }, ms);
    timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/* ---------- Battery ---------- */

export type Battery = { percent: number | null; charging: boolean | null };

const NO_BATTERY: Battery = { percent: null, charging: null };

/**
 * Reads the output of `pmset -g batt`. The first line names the power source,
 * for example "Now drawing from 'AC Power'". A desktop Mac has that line and no
 * battery line, so it gets a null percent.
 */
export function parsePmset(text: string): Battery {
  const firstLine = text.split("\n", 1)[0] ?? "";
  const charging = firstLine.includes("AC Power") ? true : firstLine.includes("Battery Power") ? false : null;
  const match = /(\d+)%/.exec(text);
  const percent = match ? Number(match[1]) : null;
  return { percent: percent !== null && percent <= 100 ? percent : null, charging };
}

export async function readBattery(): Promise<Battery> {
  if (process.platform !== "darwin") return NO_BATTERY;
  try {
    const output = await new Promise<string>((done, fail) => {
      execFile("pmset", ["-g", "batt"], { timeout: PROBE_TIMEOUT_MS, encoding: "utf8" }, (error, stdout) =>
        error ? fail(error) : done(stdout),
      );
    });
    return parsePmset(output);
  } catch {
    return NO_BATTERY;
  }
}

/* ---------- Model ---------- */

const OllamaTags = z.object({
  models: z.array(z.object({ name: z.string().optional(), model: z.string().optional() })),
});

/**
 * True when Ollama lists the model. /api/tags and not /api/ps, because Ollama
 * unloads an idle model after 5 minutes and /api/ps would say "not loaded" in
 * the middle of a drill. With MOCK_AI=1 the AI calls succeed on fixtures.
 */
export async function readModelLoaded(): Promise<boolean> {
  if (process.env.MOCK_AI === "1") return true;
  try {
    const response = await fetch(`${ollamaUrl()}/api/tags`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const tags = OllamaTags.safeParse(await response.json());
    if (!tags.success) return false;
    return tags.data.models.some((m) => m.name === OLLAMA_MODEL || m.model === OLLAMA_MODEL);
  } catch {
    return false;
  }
}

/* ---------- Storage ---------- */

/**
 * Free space, in GB, on the disk that holds the database file. statfs waits as
 * long as the filesystem does, so a database on a USB drive or a network mount
 * that went away would hang the status read without the timeout.
 */
export async function readStorageFreeGb(): Promise<number | null> {
  try {
    const stats = await within(statfs(dirname(resolve(databasePath))), PROBE_TIMEOUT_MS);
    const gb = (stats.bavail * stats.bsize) / 1e9;
    return Number.isFinite(gb) ? Math.round(gb * 10) / 10 : null;
  } catch {
    return null;
  }
}

/* ---------- Internet ---------- */

// One DNS query to the resolver the OS already uses, and no HTTP. The result
// is cached for 30 s on globalThis, so every status read and the ticker share
// one query.
//
// In the field this reads false, always. The router hands out the hub as the
// DNS server, and infra/dnsmasq.conf has no-resolv and no server= line, so
// dnsmasq answers REFUSED even after the uplink is back, and the query never
// leaves the laptop. Do not use this flag to tell staff that internet is back.
// It reads true only in dev or on a hub that does not run its own dnsmasq. On
// a hub that uses the router's DNS it can lag, because the router answers from
// its cache for a while after the uplink drops.
const INTERNET_NAME = "example.com";
const INTERNET_CACHE_MS = 30_000;

type InternetCache = { at: number; value: Promise<boolean> };
const globalForStatus = globalThis as unknown as { ulatInternetCache?: InternetCache };

async function lookupInternet(): Promise<boolean> {
  const resolver = new Resolver({ timeout: PROBE_TIMEOUT_MS, tries: 1 });
  try {
    const addresses = await within(resolver.resolve4(INTERNET_NAME), PROBE_TIMEOUT_MS, () => resolver.cancel());
    return addresses.length > 0;
  } catch {
    return false;
  }
}

export function readInternet(now = Date.now()): Promise<boolean> {
  const cached = globalForStatus.ulatInternetCache;
  if (cached && now - cached.at < INTERNET_CACHE_MS) return cached.value;
  const value = lookupInternet();
  globalForStatus.ulatInternetCache = { at: now, value };
  return value;
}
