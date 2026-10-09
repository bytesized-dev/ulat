import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheckIcon, PrinterIcon, QrCodeIcon, SmartphoneIcon } from "lucide-react";
import { ClearDataButton } from "@/components/hub/kit/clear-data-button";
import { KitCard, KitRow, KitRows } from "@/components/hub/kit/kit-card";
import { SimulationSwitch } from "@/components/hub/kit/simulation-switch";
import { HubPage } from "@/components/hub/hub-page";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db/client";
import { routes } from "@/lib/contracts/routes";
import { modelLabel } from "@/lib/hub/kit-format";
import { OLLAMA_MODEL } from "@/lib/ai/config";
import { readKitSetup } from "@/lib/hub/setup";
import { readHubStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Kit setup" };

// The status, the map files and the responders are read on every request.
export const dynamic = "force-dynamic";

const secondary = buttonVariants({ variant: "secondary", size: "hub" });

// The status is the one GET /api/hub/status sends. Values the hub cannot read
// show as Unknown, Not set or None, and nothing is filled in.
export default async function KitSetupPage() {
  const kit = readKitSetup(db, await readHubStatus());

  return (
    <HubPage title="Kit setup" active={routes.hub.setup}>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-6">
        <Link href={routes.hub.checklist} className={secondary}>
          <ClipboardCheckIcon aria-hidden="true" />
          Before the storm
        </Link>
        <SimulationSwitch initial={kit.simulation} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <KitCard title="Network" pill={kit.network.pill}>
          <KitRows>
            <KitRow label="Wi-Fi">{kit.network.wifi}</KitRow>
            <KitRow label="Phones" mono>
              {kit.network.phones}
            </KitRow>
            <KitRow label="Internet">{kit.network.internet}</KitRow>
          </KitRows>
        </KitCard>

        <KitCard title="Web address" pill={kit.address.pill}>
          <KitRows>
            <KitRow label="Address">{kit.address.domain}</KitRow>
            <KitRow label="Expires">{kit.address.expires}</KitRow>
          </KitRows>
        </KitCard>

        <KitCard title="Offline map" id="map" pill={kit.map.pill}>
          <KitRows>
            <KitRow label="Area">{kit.map.area}</KitRow>
            <KitRow label="Barangays" mono>
              {kit.map.barangays ?? "Unknown"}
            </KitRow>
          </KitRows>
          <Link href={routes.hub.mapAdd} className={`${secondary} self-start`}>
            Edit places
          </Link>
        </KitCard>

        <KitCard title="AI" pill={kit.ai.pill}>
          <KitRows>
            <KitRow label="Model">{modelLabel(OLLAMA_MODEL)}</KitRow>
          </KitRows>
          <Link href={routes.hub.aiCheck} className={`${secondary} self-start`}>
            AI check
          </Link>
        </KitCard>

        <KitCard title="Power" pill={kit.power.pill}>
          <KitRows>
            <KitRow label="Battery" mono>
              {kit.power.battery}
            </KitRow>
            <KitRow label="Storage free" mono>
              {kit.power.storageFree}
            </KitRow>
          </KitRows>
        </KitCard>

        <KitCard title="Responders" id="responders" pill={kit.responders.pill}>
          <KitRows>
            {kit.responders.rows.slice(0, 3).map((responder) => (
              <KitRow key={responder.id} label={responder.name}>
                {responder.team ?? "No team"}
              </KitRow>
            ))}
            {kit.responders.total === 0 ? <KitRow label="Responders">None yet</KitRow> : null}
            {kit.responders.total > 3 ? <KitRow label={`And ${kit.responders.total - 3} more`}>{null}</KitRow> : null}
          </KitRows>
          <Link href={routes.responder.signIn} className={`${secondary} self-start`}>
            <SmartphoneIcon aria-hidden="true" />
            Responder app
          </Link>
        </KitCard>

        <KitCard title="Join poster">
          <div className="flex items-center gap-4">
            <span aria-hidden="true" className="flex size-22 shrink-0 items-center justify-center rounded-lg bg-surface-soft text-ink [&_svg]:size-10">
              <QrCodeIcon />
            </span>
            <Link href={routes.hub.poster} className={buttonVariants({ variant: "primary", size: "hub" })}>
              <PrinterIcon aria-hidden="true" />
              Print
            </Link>
          </div>
        </KitCard>

        <KitCard title="End the drill" id="drill">
          <p className="text-body-sm text-body">Clears all simulation data.</p>
          <ClearDataButton />
        </KitCard>
      </div>
    </HubPage>
  );
}
