"use client";

import * as React from "react";
import { MapPinIcon } from "lucide-react";
import { MapView, type BarangayCollection } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import type { Bbox } from "@/lib/hub/map-projection";
import { useDesk } from "./desk-context";
import type { Spot } from "./desk-report";

type PickOnMapProps = {
  /** The town, from the map_bbox setting. */
  bbox: Bbox;
  barangays: BarangayCollection | undefined;
};

// Staff move the map under the center pin, like /hub/map/add, and the spot
// under the pin becomes the report's location. The map only mounts while the
// dialog is open, so the page loads no map until staff ask for one.
function Picker({ bbox, barangays, onUse }: PickOnMapProps & { onUse: (spot: Spot) => void }) {
  const { spot } = useDesk();
  const [position, setPosition] = React.useState<Spot | null>(null);
  return (
    <>
      <div className="relative aspect-3/2 w-full">
        <MapView
          layout="hub"
          bbox={bbox}
          barangays={barangays}
          pins={[]}
          focus={spot ?? undefined}
          label="Map. Move it to put the pin on the house."
          onMove={setPosition}
          centerPin
          className="h-full"
        />
        <Pill className="absolute top-3.5 left-1/2 h-8.5 -translate-x-1/2 bg-ink px-3.5 text-canvas">Drag to place</Pill>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary" size="hub">
            Cancel
          </Button>
        </DialogClose>
        <Button type="button" size="hub" disabled={!position} onClick={() => position && onUse(position)}>
          Use this spot
        </Button>
      </DialogFooter>
    </>
  );
}

/** Pick on map, next to Save on the household form. Shows what was picked and lets staff clear it. */
export function PickOnMap({ bbox, barangays }: PickOnMapProps) {
  const { spot, setSpot } = useDesk();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="secondary" size="hub">
            <MapPinIcon aria-hidden="true" />
            Pick on map
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-title-md">Pick on map</DialogTitle>
            <DialogDescription>Move the map until the pin is on the house.</DialogDescription>
          </DialogHeader>
          <Picker
            bbox={bbox}
            barangays={barangays}
            onUse={(next) => {
              setSpot(next);
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      {spot ? (
        <p role="status" className="flex items-center gap-2 text-body-sm text-body">
          Location set
          <Button type="button" variant="tertiary" size="hub" onClick={() => setSpot(null)}>
            Clear
          </Button>
        </p>
      ) : null}
    </>
  );
}
