import { notFound } from "next/navigation";
import { MapCheck, type MapCheckView } from "./map-check";

/*
  BYT-4 check page for MapView in isolation, with seed data and stand-in
  barangays. Not a product screen: /hub/map is BYT-40. Development only, since
  it shows seed household names without the staff PIN.
*/

const views: MapCheckView[] = ["hub", "family", "responder"];

export default async function MapCheckPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  const current = views.find((v) => v === view) ?? "hub";

  return (
    <main className={current === "hub" ? "h-dvh bg-canvas p-8" : "h-dvh bg-canvas"}>
      <MapCheck view={current} />
    </main>
  );
}
