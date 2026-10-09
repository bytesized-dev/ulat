import type { Metadata } from "next";
import { BeforeYouSendForm } from "@/components/family/before-you-send-form";

export const metadata: Metadata = { title: "Before you send" };

export default function BeforeYouSendPage() {
  return <BeforeYouSendForm />;
}
