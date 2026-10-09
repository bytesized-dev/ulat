import type { Metadata } from "next";
import { readSetting } from "@/lib/auth/settings";
import { CheckReportForm } from "@/components/family/check-report-form";
import { parseBarangays } from "../parse-barangays";

export const metadata: Metadata = { title: "Check your report" };

// The edit sheet offers the barangays set on the hub, so the page is built for
// each request instead of once at build time.
export const dynamic = "force-dynamic";

export default function CheckYourReportPage() {
  return <CheckReportForm barangays={parseBarangays(readSetting("barangays"))} />;
}
