import type { Metadata } from "next";
import { HubPage } from "@/components/hub/hub-page";
import { routes } from "@/lib/contracts/routes";

export const metadata: Metadata = { title: "Overview" };

// The review count reads the database on every request.
export const dynamic = "force-dynamic";

// Placeholder until the hub overview lands in BYT-39.

export default function HubOverviewPage() {
  return (
    <HubPage title="Overview" active={routes.hub.overview}>
      {null}
    </HubPage>
  );
}
