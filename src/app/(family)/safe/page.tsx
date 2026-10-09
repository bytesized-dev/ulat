import type { Metadata } from "next";
import { SafeForm } from "@/components/family/safe-form";
import { readSetting } from "@/lib/auth/settings";
import { parseBarangays } from "../report/parse-barangays";
import { readShelterNames } from "../report/read-shelters";
import { whereOptions } from "../report/where-options";

export const metadata: Metadata = { title: "I'm safe" };

// The barangay and shelter lists are set on the hub, so the page is built for
// each request instead of once at build time.
export const dynamic = "force-dynamic";

export default function SafePage() {
  return <SafeForm barangays={parseBarangays(readSetting("barangays"))} stayingOptions={whereOptions(readShelterNames())} />;
}
