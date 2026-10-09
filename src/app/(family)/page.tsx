import Link from "next/link";
import { MapIcon, SearchIcon, ShieldCheckIcon, UsersRoundIcon } from "lucide-react";
import { HomeUpdate } from "@/components/family/home-update";
import { Button } from "@/components/ui/button";
import { DarkHero } from "@/components/ui/dark-hero";
import { Row } from "@/components/ui/row";
import { routes } from "@/lib/contracts/routes";

// PLACEHOLDER. The hub has no setting for the evacuation center name yet.
const centerName = "Poblacion evacuation center";

const more = [
  { label: "Report for a neighbor", href: routes.family.reportNeighbor, icon: <UsersRoundIcon /> },
  { label: "Check my report", href: routes.family.status(), icon: <SearchIcon /> },
  { label: "Map", href: routes.family.map, icon: <MapIcon /> },
  { label: "I'm safe", href: routes.family.safe, icon: <ShieldCheckIcon /> },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-prose flex-col">
      <DarkHero as="h1" eyebrow="You're at" title={centerName} className="rounded-none px-gutter pt-9 pb-7">
        <Button asChild className="mt-7 w-full">
          <Link href={routes.family.report}>Report my household</Link>
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
