import type { Metadata } from "next";
import { db } from "@/db/client";
import { routes } from "@/lib/contracts/routes";
import { requireStaffPage } from "@/lib/hub/staff-page";
import { listUpdates } from "@/lib/hub/updates";
import { HubPage } from "@/components/hub/hub-page";
import { PostedList } from "@/components/hub/updates/posted-list";
import { UpdateForm } from "@/components/hub/updates/update-form";

export const metadata: Metadata = { title: "Updates" };
export const dynamic = "force-dynamic";

// src/proxy.ts redirects first; requireStaffPage does not rely on it.
export default async function UpdatesPage() {
  await requireStaffPage();
  const posted = listUpdates(db).map(({ id, type, headline, posted_at, seen_count }) => ({ id, type, headline, posted_at, seen_count }));
  return (
    <HubPage title="Updates" active={routes.hub.updates} rail={<PostedList items={posted} />}>
      <UpdateForm />
    </HubPage>
  );
}
