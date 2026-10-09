import type { Metadata } from "next";
import { HubShell } from "@/components/hub/hub-shell";
import { getReviewCount } from "@/lib/hub/review-count";

export const metadata: Metadata = { title: "Hub" };

// The review count reads the database on every request.
export const dynamic = "force-dynamic";

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <HubShell reviewCount={getReviewCount()}>{children}</HubShell>;
}
