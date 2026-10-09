import type { Metadata } from "next";
import { ReportSent } from "@/components/family/report-sent";

export const metadata: Metadata = { title: "Report sent" };

export default function ReportSentPage() {
  return <ReportSent />;
}
