import { AssessForm } from "@/components/responder/assess-form";
import { BARANGAYS } from "@/components/responder/capture";

export const dynamic = "force-dynamic";

// A house nobody reported. The responder types it in and the capture flow
// creates an entry with no linked report.
export default function NewHousePage() {
  return <AssessForm newHouse house={{ report_code: null, barangay: BARANGAYS[0], purok: null, household_head: null }} />;
}
