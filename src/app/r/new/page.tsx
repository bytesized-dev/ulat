import { AssessForm } from "@/components/responder/assess-form";
import { parseBarangays } from "@/app/(family)/report/parse-barangays";
import { readSetting } from "@/lib/auth/settings";

export const dynamic = "force-dynamic";

// A house nobody reported. The responder types it in and the capture flow
// creates an entry with no linked report. The barangay list is the hub's, so an
// entry matches the hub map and the per-barangay totals. The parser comes from
// the family folder for now. CJ can move it into src/lib later.
export default function NewHousePage() {
  const barangays = parseBarangays(readSetting("barangays"));
  return <AssessForm newHouse barangays={barangays} house={{ report_code: null, barangay: barangays[0] ?? "", purok: null, household_head: null }} />;
}
