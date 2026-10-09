import type { Metadata } from "next";
import { SafeDone } from "@/components/family/safe-done";

export const metadata: Metadata = { title: "On the safe list" };

export default function SafeDonePage() {
  return <SafeDone />;
}
