"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/contracts/routes";
import { DamageMap } from "./damage-map";
import { useHubMap } from "./map-provider";

/** Add point, then the map with its legend. Pins follow the layers that are on. */
export function HubMapMain() {
  const { bbox, pins, shading, selected, select } = useHubMap();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild variant="secondary" size="hub">
          <Link href={routes.hub.mapAdd}>
            <PlusIcon aria-hidden="true" />
            Add point
          </Link>
        </Button>
      </div>
      <DamageMap
        bbox={bbox}
        pins={pins}
        shading={shading}
        selectedId={selected?.pin.id}
        onSelect={select}
        className="h-144"
      />
    </div>
  );
}
