"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapView, type BarangayCollection } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { TopBar } from "@/components/ui/top-bar";
import { routes } from "@/lib/contracts";
import { useMounted } from "@/lib/use-mounted";
import type { Bbox, LngLat } from "@/lib/hub/map-projection";
import { barangayAt, homeChange, insideTown, placeLine, savedHome } from "./home-location";
import { updateDraft, useReportDraft } from "./use-report-draft";
import { FamilyScreen } from "./family-screen";

type HomeLocationFormProps = {
  /** The town, from the hub's map_bbox setting. The map starts here until a spot is known. */
  bbox: Bbox;
  /** Barangay outlines, to name the barangay under the pin. */
  barangays: BarangayCollection | undefined;
  /** The barangays staff set up on the hub. The draft only takes one of these. */
  hubBarangays: readonly string[];
};

// Step 3 of 4, reached from the check screen. The map starts on the saved home,
// else on a GPS fix when the phone allows one, else on the town, and the family
// moves it until the pin is over their house. GPS is one try: a refusal or a
// timeout leaves the map where it is and shows nothing, since moving the map
// works the same.
function HomeLocationForm({ bbox, barangays, hubBarangays }: HomeLocationFormProps) {
  const router = useRouter();
  const draft = useReportDraft();
  const mounted = useMounted();
  const [fix, setFix] = useState<LngLat | undefined>();
  const [center, setCenter] = useState<LngLat | null>(null);
  const saved = savedHome(draft);
  const hasSaved = saved !== null;

  // The draft is empty until the page hydrates, so wait before deciding there is no saved home.
  useEffect(() => {
    if (!mounted || hasSaved || !("geolocation" in navigator)) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const found = { lat: coords.latitude, lng: coords.longitude };
        if (!cancelled && insideTown(found)) setFix(found);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
    return () => {
      cancelled = true;
    };
  }, [mounted, hasSaved]);

  const barangay = center ? barangayAt(center, barangays) : null;

  function useThisSpot() {
    if (!center) return;
    updateDraft(homeChange(center, barangay, hubBarangays));
    // Replace, so Back from the check screen does not return to the map.
    router.replace(routes.family.check);
  }

  return (
    <FamilyScreen fit="screen">
      <TopBar title="Location" leading={{ kind: "back", href: routes.family.check }} />
      <ProgressSteps step={3} className="px-gutter pb-1.5" />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <MapView
          bbox={bbox}
          barangays={barangays}
          pins={[]}
          label="Map. Move it to put the pin over your house."
          focus={saved ?? fix}
          onMove={setCenter}
          centerPin
          className="flex-1"
        />
        <Pill className="absolute top-3.5 left-1/2 h-8.5 -translate-x-1/2 bg-ink px-3.5 text-canvas">
          Move the map to your house
        </Pill>
      </div>

      <footer className="flex flex-col gap-2.5 bg-canvas px-gutter pt-3 pb-7">
        <p aria-live="polite" className="text-body-md font-medium text-ink">
          {placeLine(barangay, draft.purok)}
        </p>
        <Button type="button" className="w-full" disabled={!center} onClick={useThisSpot}>
          Use this spot
        </Button>
      </footer>
    </FamilyScreen>
  );
}

export { HomeLocationForm };
