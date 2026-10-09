"use client";

import { cn } from "@/lib/utils";
import { isLowBattery } from "@/lib/hub/battery";
import { formatBattery } from "@/lib/hub/status";
import { useHubStatus } from "./hub-status-provider";

/** Internet, phones and battery from the shared hub status. */
export function HubStatusBlock() {
  const status = useHubStatus();

  const rows: { label: string; value: string; mono?: boolean; alert?: boolean }[] = [
    { label: "Internet", value: status ? (status.internet ? "Online" : "Offline") : "Unknown" },
    { label: "Phones", value: status ? String(status.phones) : "Unknown", mono: true },
    { label: "Battery", value: formatBattery(status?.battery_percent), mono: true, alert: isLowBattery(status) },
  ];

  return (
    <dl className="grid gap-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between">
          <dt className="text-body">{row.label}</dt>
          <dd className={cn("font-semibold", row.alert ? "text-danger" : "text-ink", row.mono && "font-mono")}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
