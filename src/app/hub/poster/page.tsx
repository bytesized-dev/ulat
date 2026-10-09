import type { Metadata } from "next";
import { PosterSheet } from "@/components/hub/print/poster-sheet";
import { PrintControls } from "@/components/hub/print/print-controls";
import { PrintFrame } from "@/components/hub/print/print-sheet";
import { db } from "@/db/client";
import { routes } from "@/lib/contracts/routes";
import { readPoster } from "@/lib/hub/print";
import { requireStaffPage } from "@/lib/hub/staff-page";

export const metadata: Metadata = { title: "Join poster" };

// The address, Wi-Fi name and town are settings, read on every request.
export const dynamic = "force-dynamic";

// The join poster for the evacuation center on one A4 page. The QR code
// encodes the hub_address setting.
export default async function PosterPage() {
  await requireStaffPage();
  const poster = readPoster(db);

  return (
    <PrintFrame controls={<PrintControls backHref={routes.hub.setup} />}>
      <PosterSheet poster={poster} />
    </PrintFrame>
  );
}
