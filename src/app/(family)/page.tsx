import Link from "next/link";
import { MapIcon, SearchIcon, ShieldCheckIcon, UsersRoundIcon } from "lucide-react";
import { CurrentPlace } from "@/components/family/current-place";
import { HomeUpdate } from "@/components/family/home-update";
import { Button } from "@/components/ui/button";
import { DarkHero } from "@/components/ui/dark-hero";
import { Row } from "@/components/ui/row";
import { readSetting } from "@/lib/auth/settings";
import { routes } from "@/lib/contracts/routes";

// The town is a hub setting, so it is read on each request.
export const dynamic = "force-dynamic";

const more = [
  { label: "Report for a neighbor", href: routes.family.reportNeighbor, icon: <UsersRoundIcon /> },
  { label: "Check my report", href: routes.family.status(), icon: <SearchIcon /> },
  { label: "Map", href: routes.family.map, icon: <MapIcon /> },
  { label: "I'm safe", href: routes.family.safe, icon: <ShieldCheckIcon /> },
];

export default function HomePage() {
  // The phone swaps in its own barangay once it has a position. Until then, the town.
  const town = readSetting("town")?.trim() || "the evacuation center";
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-prose flex-col">
      <DarkHero as="h1" eyebrow="You're at" title={<CurrentPlace fallback={town} />} className="rounded-none px-gutter pt-9 pb-7">
        <Button asChild className="mt-7 w-full">
          <Link href={routes.family.reportFamily}>Report my household</Link>
        </Button>
      </DarkHero>
      <main className="flex flex-col gap-6 px-gutter pt-5 pb-7">
        <HomeUpdate />
        <section>
          <h2 className="mb-1 text-title-md">More</h2>
          <nav aria-label="More">
            {more.map((item) => (
              <Row key={item.href} href={item.href} icon={item.icon} label={<span className="text-body-md font-medium text-ink">{item.label}</span>} className="last:border-b-0" />
            ))}
          </nav>
        </section>
      </main>
    </div>
  );
}
