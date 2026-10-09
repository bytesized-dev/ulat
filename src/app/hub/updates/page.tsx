import type { Metadata } from "next";
import { db } from "@/db/client";
import { routes } from "@/lib/contracts/routes";
import { listUpdates } from "@/lib/hub/updates";
import { HubShell } from "@/components/ui/hub-shell";
import { hubNav, hubStaff } from "@/components/hub/nav";
import { PostedList } from "@/components/hub/updates/posted-list";
import { UpdateForm } from "@/components/hub/updates/update-form";

export const metadata: Metadata = { title: "Updates" };
export const dynamic = "force-dynamic";

// src/proxy.ts keeps this page behind the staff PIN.
export default function UpdatesPage() {
  const posted = listUpdates(db).map(({ id, type, headline, posted_at, seen_count }) => ({ id, type, headline, posted_at, seen_count }));
  return (
    <HubShell title="Updates" nav={hubNav} activeHref={routes.hub.updates} {...hubStaff} rail={<PostedList items={posted} />}>
      <UpdateForm />
    </HubShell>
  );
}
