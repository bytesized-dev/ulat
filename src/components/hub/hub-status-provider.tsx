"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { HubStatus } from "@/lib/contracts";
import { lockUrl } from "@/lib/hub/lock";
import { readHubStatus } from "@/lib/hub/status";

const refreshMs = 10_000;

const HubStatusContext = createContext<HubStatus | null>(null);

/**
 * Reads GET /api/hub/status every 10 seconds and shares it with the status block and the battery banner.
 * A 401 means the staff session is gone, such as after Lock hub with this page kept in the
 * router cache for the Back button, or a session that ran out. It loads the lock screen.
 */
export function HubStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<HubStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const { status: next, unauthorized } = await readHubStatus(fetch, controller.signal);
      if (controller.signal.aborted) return;
      if (unauthorized) {
        controller.abort();
        window.location.replace(lockUrl(window.location.pathname + window.location.search));
        return;
      }
      setStatus(next);
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
