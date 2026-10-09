"use client";

import { useEffect, useState } from "react";
import type { BarangayCollection } from "@/components/map";
import { mapAssets } from "@/lib/hub/map-assets";

// The boundaries are about 86 KB and never change during a storm, so they load
// once per tab from the hub instead of riding along with every live refresh.
let boundaries: Promise<BarangayCollection | undefined> | null = null;

function loadBoundaries(): Promise<BarangayCollection | undefined> {
  boundaries ??= fetch(mapAssets.barangays)
    .then((response) => (response.ok ? (response.json() as Promise<BarangayCollection>) : undefined))
    .catch(() => {
      boundaries = null;
      return undefined;
    });
  return boundaries;
}

/** The barangay outlines, once they have loaded. */
export function useBarangays(): BarangayCollection | undefined {
  const [barangays, setBarangays] = useState<BarangayCollection>();

  useEffect(() => {
    let live = true;
    void loadBoundaries().then((collection) => {
      if (live && collection) setBarangays(collection);
    });
    return () => {
      live = false;
    };
  }, []);

  return barangays;
}
