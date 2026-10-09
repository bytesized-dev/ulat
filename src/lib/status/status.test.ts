import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { HubEvent, HubStatus } from "@/lib/contracts";
import { subscribe } from "@/lib/live/bus";
import { readHubStatus, startStatusTicker } from "./index";
import { markSeen, phoneCount } from "./phones";
import { parsePmset, readBattery, readModelLoaded } from "./probes";

// There is no Windows machine to check "returns nulls instead of failing", so
// these tests take pmset, the network, the disk and Ollama away and look at
// what comes back.
const execFile = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile }));
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    resolve4() {
      return Promise.reject(new Error("ECONNREFUSED"));
    }
    cancel() {}
  },
}));
vi.mock("node:fs/promises", () => ({ statfs: () => Promise.reject(new Error("ENOENT")) }));
vi.mock("@/lib/auth/settings", () => ({ readSetting: () => "true" }));

const globalForStatus = globalThis as unknown as {
  ulatInternetCache?: unknown;
  ulatPhonesSeen?: Map<string, number>;
  ulatStatusTicker?: NodeJS.Timeout;
};

const noPmset = () => execFile.mockImplementation((...args: unknown[]) => (args.at(-1) as (e: Error) => void)(new Error("ENOENT")));

beforeEach(() => {
  vi.stubEnv("MOCK_AI", "0");
  vi.stubEnv("OLLAMA_URL", "http://127.0.0.1:1");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
  execFile.mockReset();
  noPmset();
  delete globalForStatus.ulatInternetCache;
  globalForStatus.ulatPhonesSeen?.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("parsePmset", () => {
  it("reads a laptop on the charger", () => {
    const text = "Now drawing from 'AC Power'\n -InternalBattery-0 (id=1)\t64%; charging; 1:10 remaining present: true\n";
    expect(parsePmset(text)).toEqual({ percent: 64, charging: true });
  });

  it("reads a laptop on battery", () => {
    const text = "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t83%; discharging; 5:23 remaining present: true\n";
    expect(parsePmset(text)).toEqual({ percent: 83, charging: false });
  });

  it("gives a desktop with no battery line a null percent", () => {
    expect(parsePmset("Now drawing from 'AC Power'\n")).toEqual({ percent: null, charging: true });
  });

  it("gives garbage nulls", () => {
    expect(parsePmset("")).toEqual({ percent: null, charging: null });
    expect(parsePmset("pmset: command not found")).toEqual({ percent: null, charging: null });
    expect(parsePmset("Now drawing from 'Battery Power'\n 250%")).toEqual({ percent: null, charging: false });
  });
});

describe("readHubStatus", () => {
  it("returns nulls and false, and still parses, when every probe fails", async () => {
    const status = await readHubStatus();
    expect(status).toEqual({
      internet: false,
      phones: 0,
      battery_percent: null,
      charging: null,
      model_loaded: false,
      storage_free_gb: null,
      simulation: true,
    });
    expect(HubStatus.safeParse(status).success).toBe(true);
  });

  it("does not run pmset off macOS", async () => {
    const platform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });
    try {
      expect(await readBattery()).toEqual({ percent: null, charging: null });
    } finally {
      Object.defineProperty(process, "platform", { value: platform });
    }
    expect(execFile).not.toHaveBeenCalled();
  });

  it("finds the model in the Ollama tag list, and trusts MOCK_AI", async () => {
    const tags = (names: string[]) =>
      vi.fn().mockResolvedValue(Response.json({ models: names.map((name) => ({ name, model: name })) }));
    vi.stubGlobal("fetch", tags(["llama3:8b", "gemma4:e4b"]));
    expect(await readModelLoaded()).toBe(true);
    vi.stubGlobal("fetch", tags(["llama3:8b"]));
    expect(await readModelLoaded()).toBe(false);

    vi.stubEnv("MOCK_AI", "1");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await readModelLoaded()).toBe(true);
  });
});

describe("GET /api/health", () => {
  it("answers ok and is never cached", async () => {
    const response = health(new Request("http://hub/api/health"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("counts a phone once per address and leaves loopback out", () => {
    const from = (ip: string) => new Request("http://hub/api/health", { headers: { "x-forwarded-for": ip } });
    health(from("192.168.1.20, 10.0.0.1"));
    health(from("192.168.1.20"));
    health(from("192.168.1.21"));
    health(from("127.0.0.1"));
    health(from("not an address"));
    health(new Request("http://hub/api/health"));
    expect(phoneCount()).toBe(2);
  });

  it("does not count the hub laptop, which sends the staff cookie", () => {
    const laptop = new Request("http://hub/api/health", {
      headers: { "x-forwarded-for": "192.168.8.10", cookie: "theme=dark; ulat_staff=anything" },
    });
    health(laptop);
    expect(phoneCount()).toBe(0);
  });

  it("forgets a phone after two minutes", () => {
    const now = 1_700_000_000_000;
    markSeen(new Request("http://hub/", { headers: { "x-forwarded-for": "192.168.1.20" } }), now);
    expect(phoneCount(now + 119_000)).toBe(1);
    expect(phoneCount(now + 120_000)).toBe(0);
  });
});

describe("status ticker", () => {
  it("publishes hub.status every 30 seconds, once, however often it starts", async () => {
    vi.useFakeTimers();
    clearInterval(globalForStatus.ulatStatusTicker);
    delete globalForStatus.ulatStatusTicker;

    const seen: HubEvent[] = [];
    const off = subscribe({ role: "staff" }, (event) => seen.push(event));
    try {
      startStatusTicker();
      startStatusTicker();
      await vi.advanceTimersByTimeAsync(29_999);
      expect(seen).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      expect(seen).toHaveLength(1);
      expect(seen[0].type).toBe("hub.status");
      await vi.advanceTimersByTimeAsync(30_000);
      expect(seen).toHaveLength(2);
    } finally {
      off();
      clearInterval(globalForStatus.ulatStatusTicker);
      delete globalForStatus.ulatStatusTicker;
    }
  });
});
