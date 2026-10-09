import type { Metadata } from "next";
import { db } from "@/db/client";
import { HubPage } from "@/components/hub/hub-page";
import { DeskProvider } from "@/components/hub/desk/desk-context";
import { DeskForm } from "@/components/hub/desk/desk-form";
import { DeskRail } from "@/components/hub/desk/desk-rail";
import { routes } from "@/lib/contracts/routes";
import { readBarangays, recentDesk, stayingOptions } from "@/lib/hub/desk";

export const metadata: Metadata = { title: "Help desk" };

// The recent list changes with every report the desk files.
export const dynamic = "force-dynamic";

export default function HelpDeskPage() {
  return (
    <DeskProvider>
      <HubPage title="Help desk" active={routes.hub.desk} rail={<DeskRail recent={recentDesk(db)} />}>
        <DeskForm barangays={readBarangays(db)} staying={stayingOptions(db)} />
      </HubPage>
    </DeskProvider>
  );
}
