import { notFound } from "next/navigation";
import { type MapPin, shadeByTotals } from "@/components/map";
import {
  damagePins,
  demoBbox,
  legends,
  loadBarangays,
  placePins,
  reportPins,
  totalsByBarangay,
  youPin,
} from "./check-data";
import { MapCheck, type MapCheckView } from "./map-check";

/*
  BYT-4 check page for MapView in isolation, with the real Dapitan City
  barangays and seed pins. Not a product screen: /hub/map is BYT-40.
  Development only, since it shows seed household names without the staff PIN.
*/

const views: MapCheckView[] = ["hub", "family", "responder"];

// Families never see household pins or shading. See docs/SPEC.md 8.
const pinsFor: Record<MapCheckView, MapPin[]> = {
  hub: [...reportPins, ...damagePins, ...placePins],
  family: placePins,
  responder: [...reportPins, ...damagePins, ...placePins.filter((p) => p.kind === "hazard"), youPin],
};

export default async function MapCheckPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  const current = views.find((v) => v === view) ?? "hub";
  const barangays = loadBarangays();

  return (
    <main className={current === "hub" ? "h-dvh bg-canvas p-8" : "h-dvh bg-canvas"}>
      <MapCheck
        view={current}
        bbox={demoBbox}
        barangays={barangays}
        shading={current === "family" ? undefined : shadeByTotals(totalsByBarangay(barangays))}
        pins={pinsFor[current]}
        legend={legends[current]}
        initialSelectedId={damagePins[0]?.id}
      />
    </main>
  );
}
