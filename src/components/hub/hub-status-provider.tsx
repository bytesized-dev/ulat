"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { HubStatus } from "@/lib/contracts";
import { fetchHubStatus } from "@/lib/hub/status";

const refreshMs = 10_000;

const HubStatusContext = createContext<HubStatus | null>(null);

/** Reads GET /api/hub/status every 10 seconds and shares it with the status block and the battery banner. */
export function HubStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<HubStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const next = await fetchHubStatus(fetch, controller.signal);
      if (!controller.signal.aborted) setStatus(next);
    };
    void load();
    const timer = setInterval(load, refreshMs);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return <HubStatusContext value={status}>{children}</HubStatusContext>;
}

/** The latest hub status, or null before the first reply and when the hub can't be reached. */
export function useHubStatus(): HubStatus | null {
  return useContext(HubStatusContext);
}
