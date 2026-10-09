import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { HubPage } from "@/components/hub/hub-page";
import { SafeSearch } from "@/components/hub/safe-list/safe-search";
import { SafeRail } from "@/components/hub/safe-list/safe-rail";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts/routes";
import { recentSafe, safeCounts } from "@/lib/hub/safe";

export const metadata: Metadata = { title: "Safe list" };

// The list and the counts change with every check-in.
export const dynamic = "force-dynamic";

export default async function SafeListPage() {
  // The list names people, so the page is staff only, like GET /api/safe with no query.
  // src/proxy.ts redirects first; this check does not rely on it.
  const session = await readSession("staff", (await cookies()).get(SESSION_COOKIE.staff)?.value);
  if (!session) redirect(routes.hub.lock);

  const { total, staying } = safeCounts(db);
  return (
    <HubPage title="Safe list" active={routes.hub.safeList} rail={<SafeRail staying={staying} />}>
      <SafeSearch initial={recentSafe(db)} total={total} />
    </HubPage>
  );
}
