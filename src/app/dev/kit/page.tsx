import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ClipboardCheckIcon,
  CpuIcon,
  HeadsetIcon,
  HouseIcon,
  InboxIcon,
  LayoutGridIcon,
  MapIcon,
  MegaphoneIcon,
  PlusIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TableIcon,
  FileTextIcon,
} from "lucide-react";
import { routes } from "@/lib/contracts/routes";
import { cn } from "@/lib/utils";
import { AppTopBar } from "@/components/ui/app-top-bar";
import { Button } from "@/components/ui/button";
import { DarkHero } from "@/components/ui/dark-hero";
import { HubShell, type HubNavSection } from "@/components/ui/hub-shell";
import { IconPlate } from "@/components/ui/icon-plate";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { Row } from "@/components/ui/row";
import { StatusDot } from "@/components/ui/status-dot";
import { TabBar } from "@/components/ui/tab-bar";
import { Textarea } from "@/components/ui/textarea";
import { Timeline } from "@/components/ui/timeline";
import { TopBar } from "@/components/ui/top-bar";
import { ButtonRowDemo, ChipDemo, CloseTopBarDemo, CounterDemo, SegmentedDemo, SelectDemo, SheetDemo } from "./demo";

export const metadata: Metadata = {
  title: "UI kit",
};

const hubNav: HubNavSection[] = [
  {
    items: [
      { label: "Overview", href: routes.hub.overview, icon: <LayoutGridIcon /> },
      { label: "Review", href: routes.hub.review, icon: <InboxIcon />, count: 5 },
      { label: "Map", href: routes.hub.map, icon: <MapIcon /> },
      { label: "Entries", href: routes.hub.entries, icon: <TableIcon /> },
      { label: "Reports", href: routes.hub.reports, icon: <FileTextIcon /> },
      { label: "Updates", href: routes.hub.updates, icon: <MegaphoneIcon /> },
      { label: "Safe list", href: routes.hub.safeList, icon: <ShieldCheckIcon /> },
      { label: "Help desk", href: routes.hub.desk, icon: <HeadsetIcon /> },
    ],
  },
  {
    heading: "Kit",
    items: [
      { label: "Before the storm", href: routes.hub.checklist, icon: <ClipboardCheckIcon /> },
      { label: "Kit setup", href: routes.hub.setup, icon: <SettingsIcon /> },
      { label: "AI check", href: routes.hub.aiCheck, icon: <CpuIcon /> },
    ],
  },
];

function Group({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-8">
      <h2 id={id} className="text-title-page">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Specimen({ name, note, children, wide = false }: { name: string; note?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "flex flex-col gap-3 lg:col-span-2" : "flex flex-col gap-3"}>
      <div className="flex items-baseline gap-3">
        <h3 className="text-title-md">{name}</h3>
        {note ? <p className="text-body-sm text-body">{note}</p> : null}
      </div>
      {children}
    </div>
  );
}

// A phone-width frame, so a phone component is judged at the width it ships at.
function Phone({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full max-w-sm overflow-hidden rounded-lg border border-hairline bg-canvas", className)}>{children}</div>;
}

export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-16 px-gutter py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-display-md">UI kit</h1>
        <p className="text-body-md text-body">Every component in DESIGN.md, with its variants. Development only.</p>
      </header>

      <Group id="phone" title="Phone">
        <div className="grid gap-x-8 gap-y-12 lg:grid-cols-2">
          <Specimen name="Button" note="Phone size is 56px. Disabled in the second row.">
            <div className="flex flex-col gap-3">
              <Button>Continue</Button>
              <Button variant="secondary">
                <PlusIcon aria-hidden="true" />
                New house
              </Button>
              <Button variant="tertiary">Skip for now</Button>
              <DarkHero className="flex flex-col gap-3">
                <Button variant="outline-dark">Post update</Button>
                <Button variant="outline-dark" disabled>
                  Post update
                </Button>
              </DarkHero>
              <div className="flex flex-col gap-3">
                <Button disabled>Continue</Button>
                <Button variant="secondary" disabled>
                  New house
                </Button>
                <Button variant="tertiary" disabled>
                  Skip for now
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Button size="icon" variant="primary" aria-label="Add a person">
                  <PlusIcon aria-hidden="true" />
                </Button>
                <Button size="icon" variant="secondary" aria-label="Add a household">
                  <HouseIcon aria-hidden="true" />
                </Button>
                <Button size="icon" variant="tertiary" aria-label="Add a note">
                  <PlusIcon aria-hidden="true" />
                </Button>
              </div>
            </div>
          </Specimen>

          <Specimen name="Input, Select, Textarea" note="52px. Click into a field for the focus border.">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="kit-name">Head of household</Label>
                <Input id="kit-name" placeholder="Full name" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="kit-invalid">Phone number</Label>
                <Input id="kit-invalid" defaultValue="0917" aria-invalid="true" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="kit-disabled">Barangay</Label>
                <Input id="kit-disabled" defaultValue="San Isidro" disabled />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Barangay</Label>
                <SelectDemo size="phone" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="kit-note">What happened</Label>
                <Textarea id="kit-note" placeholder="Tell us in a few words" />
              </div>
            </div>
          </Specimen>

          <Specimen name="TopBar" note="Back, close, and a right slot.">
            <div className="flex flex-col gap-4">
              <Phone>
                <TopBar title="New report" leading={{ kind: "back", href: routes.family.report }} />
              </Phone>
              <Phone>
                <CloseTopBarDemo />
              </Phone>
              <Phone>
                <TopBar title="Your report" />
              </Phone>
            </div>
          </Specimen>

          <Specimen name="AppTopBar">
            <Phone>
              <AppTopBar name="Mae Santos" searchLabel="Search reports" />
            </Phone>
          </Specimen>

          <Specimen name="ProgressSteps" note="Steps 1 to 4.">
            <Phone className="flex flex-col gap-6 p-5">
              <ProgressSteps step={1} />
              <ProgressSteps step={2} />
              <ProgressSteps step={3} />
              <ProgressSteps step={4} />
            </Phone>
          </Specimen>

          <Specimen name="Row" note="Link, button and static. IconPlate and Pill on the right.">
            <Phone className="px-5">
              <Row href={routes.family.check} label="Head of household" value="Rosa Dela Cruz" />
              <ButtonRowDemo />
              <Row label="Barangay" value="San Isidro, Purok 3" />
              <Row
                href={routes.responder.report("DC41")}
                icon={<HouseIcon />}
                label="San Isidro, Purok 3"
                value="Dela Cruz household"
                trailing={
                  <>
                    <span className="font-mono text-mono-sm text-ink tabular">350 m</span>
                    <Pill dot="danger">1 hurt</Pill>
                  </>
                }
              />
            </Phone>
          </Specimen>

          <Specimen name="IconPlate, Pill, StatusDot">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <IconPlate>
                  <HouseIcon />
                </IconPlate>
                <IconPlate>
                  <MapIcon />
                </IconPlate>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill>Simulation</Pill>
                <Pill dot="danger">High</Pill>
                <Pill dot="warning">Medium</Pill>
                <Pill dot="success">Matched</Pill>
                <Pill dot="primary">Relief</Pill>
                <Pill dot="muted-soft">Low</Pill>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-body-sm">
                <span className="flex items-center gap-2">
                  <StatusDot tone="danger" /> danger
                </span>
                <span className="flex items-center gap-2">
                  <StatusDot tone="warning" /> warning
                </span>
                <span className="flex items-center gap-2">
                  <StatusDot tone="success" /> success
                </span>
                <span className="flex items-center gap-2">
                  <StatusDot tone="primary" /> primary
                </span>
                <span className="flex items-center gap-2">
                  <StatusDot tone="muted-soft" /> muted-soft
                </span>
              </div>
            </div>
          </Specimen>

          <Specimen name="Chip" note="44px toggles. Off, on and disabled.">
            <ChipDemo />
          </Specimen>

          <Specimen name="Counter" note="Hurt cannot go above the people in the house.">
            <CounterDemo />
          </Specimen>

          <Specimen name="Timeline" note="Done, current and upcoming.">
            <Timeline
              items={[
                { label: "Report sent", time: "2:41 PM", state: "done" },
                { label: "Responder assigned", time: "2:48 PM", state: "done" },
                { label: "On the way", time: "3:02 PM", state: "current" },
                { label: "House checked", state: "upcoming" },
              ]}
            />
          </Specimen>

          <Specimen name="DarkHero">
            <DarkHero eyebrow="Your report code" title="B3N6">
              <p className="mt-2 text-body-md text-muted-soft">Keep this code to see your status.</p>
            </DarkHero>
          </Specimen>

          <Specimen name="TabBar" note="Each tab active in turn.">
            <div className="flex flex-col gap-3">
              <Phone>
                <TabBar active="toVisit" />
              </Phone>
              <Phone>
                <TabBar active="map" />
              </Phone>
              <Phone>
                <TabBar active="done" />
              </Phone>
              <Phone>
                <TabBar active="queue" />
              </Phone>
            </div>
          </Specimen>

          <Specimen name="Sheet" note="Opens from the bottom.">
            <div>
              <SheetDemo />
            </div>
          </Specimen>
        </div>
      </Group>

      <Group id="hub" title="Hub">
        <div className="grid gap-x-8 gap-y-12 lg:grid-cols-2">
          <Specimen name="Button" note="Hub size is 40px, with a 44px tap target.">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="hub">Make report</Button>
              <Button size="hub" variant="secondary">
                Post update
              </Button>
              <Button size="hub" variant="tertiary">
                Open map
              </Button>
              <DarkHero size="hub" className="flex gap-3 p-4">
                <Button size="hub" variant="outline-dark">
                  Post update
                </Button>
              </DarkHero>
              <Button size="hub" disabled>
                Make report
              </Button>
              <Button size="icon" variant="secondary" aria-label="Print poster">
                <PlusIcon aria-hidden="true" />
              </Button>
            </div>
          </Specimen>

          <Specimen name="Input, Select" note="44px.">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="kit-hub-name">Head of household</Label>
                <Input id="kit-hub-name" size="hub" placeholder="Full name" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Barangay</Label>
                <SelectDemo size="hub" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="kit-hub-note">Note</Label>
                <Textarea id="kit-hub-note" size="hub" placeholder="Add a note" />
              </div>
            </div>
          </Specimen>

          <Specimen name="Segmented" note="Radios in a pill track. Hub and phone sizes.">
            <SegmentedDemo />
          </Specimen>

          <Specimen name="DarkHero" note="Hub size, with the overview headline.">
            <DarkHero size="hub" eyebrow="Situation at 3:00 PM" title="46 houses checked">
              <p className="mt-4 flex items-center gap-2 text-body-sm text-muted-soft">
                <StatusDot tone="danger" />
                <span className="font-mono text-mono-sm text-canvas">14</span> totally
              </p>
              <p className="mt-6 font-mono text-mono-md text-canvas">241</p>
            </DarkHero>
          </Specimen>

          <Specimen name="HubShell" note="Sidebar, top bar and right rail. Props only." wide>
            <div className="h-160 overflow-hidden rounded-lg border border-hairline">
              <HubShell
                className="h-full min-h-0 [&>aside]:h-full"
                title="Overview"
                nav={hubNav}
                activeHref={routes.hub.overview}
                simulation
                name="MDRRMO staff"
                status={
                  <dl className="flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <dt className="text-muted-text">Internet</dt>
                      <dd className="font-semibold">Offline</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-text">Phones</dt>
                      <dd className="font-mono font-medium">9</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-text">Battery</dt>
                      <dd className="font-mono font-medium">68%</dd>
                    </div>
                  </dl>
                }
                rail={
                  <div className="flex flex-col gap-3">
                    <h2 className="text-title-md">Go first</h2>
                    <div className="flex items-center justify-between">
                      <span className="text-body-md font-medium">San Isidro</span>
                      <Pill dot="danger">High</Pill>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-body-md font-medium">Mabini</span>
                      <Pill dot="warning">Medium</Pill>
                    </div>
                  </div>
                }
              >
                <h2 className="text-title-md">Damage by barangay</h2>
              </HubShell>
            </div>
          </Specimen>

          <Specimen name="MapView" note="Lands in BYT-4.">
            <p className="text-body-md text-body">Not part of this kit yet. The map, its tiles and its dependency come with BYT-4.</p>
          </Specimen>
        </div>
      </Group>
    </main>
  );
}
