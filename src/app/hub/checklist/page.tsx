import type { Metadata } from "next";
import { ChecklistPanel } from "@/components/hub/kit/checklist-panel";
import { KitRow, KitRows } from "@/components/hub/kit/kit-card";
import { HubPage } from "@/components/hub/hub-page";
import { db } from "@/db/client";
import { routes } from "@/lib/contracts/routes";
import { readChecklist } from "@/lib/hub/checklist";
import { readKitSetup } from "@/lib/hub/setup";
import { readHubStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Before the storm" };

// The ticks and the kit state are read on every request.
export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const checklist = readChecklist(db);
  const { kitNow } = readKitSetup(db, await readHubStatus());

  const rail = (
    <section>
      <h2 className="text-title-md text-ink">Kit now</h2>
      <KitRows className="mt-3">
        <KitRow label="Internet">{kitNow.internet}</KitRow>
        <KitRow label="Map">{kitNow.map}</KitRow>
        <KitRow label="AI">{kitNow.ai}</KitRow>
        <KitRow label="Certificate">{kitNow.certificate}</KitRow>
        <KitRow label="Battery" mono>
          {kitNow.battery}
        </KitRow>
      </KitRows>
    </section>
  );

  return (
    <HubPage title="Before the storm" active={routes.hub.checklist} rail={rail}>
      <ChecklistPanel initial={checklist} />
    </HubPage>
  );
}
