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
    // A phone gets one column. From md the hero and the list become two cards
    // on the soft surface, and from lg they sit side by side.
    <div className="flex min-h-dvh flex-col md:justify-center md:bg-surface-soft md:px-gutter md:py-10">
      <div className="mx-auto flex w-full max-w-prose flex-1 flex-col md:flex-none md:gap-4 lg:grid lg:max-w-content lg:grid-cols-2 lg:gap-6">
        <DarkHero
          as="h1"
          eyebrow="You're at"
          title={<CurrentPlace fallback={town} />}
          titleClassName="md:text-display-lg"
          className="flex flex-col rounded-none px-gutter pt-9 pb-7 md:rounded-xl md:p-8"
        >
          <Button asChild className="mt-7 w-full lg:mt-auto">
            <Link href={routes.family.reportFamily}>Report my household</Link>
          </Button>
        </DarkHero>
        <main className="flex flex-col gap-6 bg-canvas px-gutter pt-5 pb-7 md:rounded-xl md:border md:border-hairline md:p-8">
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
    </div>
  );
}
