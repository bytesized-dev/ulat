import type { Metadata } from "next";
import { CheckReportForm } from "@/components/family/check-report-form";

export const metadata: Metadata = { title: "Check your report" };

export default function CheckYourReportPage() {
  return <CheckReportForm />;
}
