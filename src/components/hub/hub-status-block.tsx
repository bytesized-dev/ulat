"use client";

import { useEffect, useState } from "react";
import type { HubStatus } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { fetchHubStatus, formatBattery } from "@/lib/hub/status";

const refreshMs = 10_000;

/** Internet, phones and battery from GET /api/hub/status, refreshed every 10 seconds. */
export function HubStatusBlock() {
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

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Internet", value: status ? (status.internet ? "Online" : "Offline") : "Unknown" },
    { label: "Phones", value: status ? String(status.phones) : "Unknown", mono: true },
    { label: "Battery", value: formatBattery(status?.battery_percent), mono: true },
  ];

  return (
    <dl className="grid gap-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between">
          <dt className="text-body">{row.label}</dt>
          <dd className={cn("font-semibold text-ink", row.mono && "font-mono")}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
