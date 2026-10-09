import type { Metadata } from "next";
import { readSetting } from "@/lib/auth/settings";
import { WhoseHouseholdForm } from "@/components/family/whose-household-form";
import { parseBarangays } from "./parse-barangays";
import { parseFor } from "./parse-for";

export const metadata: Metadata = { title: "New report" };

// The barangay list is set on the hub, so the page is built for each request
// instead of once at build time.
export const dynamic = "force-dynamic";

type ReportStartPageProps = {
  searchParams: Promise<{ for?: string | string[] }>;
};

export default async function ReportStartPage({ searchParams }: ReportStartPageProps) {
  const { for: household } = await searchParams;
  return <WhoseHouseholdForm barangays={parseBarangays(readSetting("barangays"))} requestedSource={parseFor(household)} />;
}
