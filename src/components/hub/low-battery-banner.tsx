"use client";

import Link from "next/link";
import { BatteryLowIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconPlate } from "@/components/ui/icon-plate";
import { routes } from "@/lib/contracts/routes";
import { isLowBattery } from "@/lib/hub/battery";
import { useHubStatus } from "./hub-status-provider";

/** Shown above the page content when the hub battery is under 20% and not charging. */
export function LowBatteryBanner() {
  const status = useHubStatus();
  if (!status || !isLowBattery(status)) return null;

  return (
    <div role="alert" className="mb-6 flex items-center gap-4 rounded-lg border border-hairline bg-canvas p-4.5">
      <IconPlate className="text-danger">
        <BatteryLowIcon />
      </IconPlate>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-danger">Battery {status.battery_percent}%</p>
        <p className="text-body-sm text-body">Plug in a power bank or generator now.</p>
      </div>
      <Button asChild variant="secondary" size="hub">
        <Link href={routes.hub.setup}>Power</Link>
      </Button>
    </div>
  );
}
