import type { Metadata } from "next";
import { readSetting } from "@/lib/auth/settings";
import { WhoseHouseholdForm } from "@/components/family/whose-household-form";
import { parseBarangays } from "./parse-barangays";

export const metadata: Metadata = { title: "New report" };

// The barangay list is a setting the hub can change, so the page is built for
// each request instead of once at build time.
export const dynamic = "force-dynamic";

export default function ReportStartPage() {
  return <WhoseHouseholdForm barangays={parseBarangays(readSetting("barangays"))} />;
}
