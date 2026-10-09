import type { Metadata } from "next";
import { db } from "@/db/client";
import { HubPage } from "@/components/hub/hub-page";
import { SafeSearch } from "@/components/hub/safe-list/safe-search";
import { SafeRail } from "@/components/hub/safe-list/safe-rail";
import { routes } from "@/lib/contracts/routes";
import { recentSafe, safeCounts } from "@/lib/hub/safe";

export const metadata: Metadata = { title: "Safe list" };

// The list and the counts change with every check-in.
export const dynamic = "force-dynamic";

export default function SafeListPage() {
  const { total, staying } = safeCounts(db);
  return (
    <HubPage title="Safe list" active={routes.hub.safeList} rail={<SafeRail staying={staying} />}>
      <SafeSearch initial={recentSafe(db)} total={total} />
    </HubPage>
  );
}
