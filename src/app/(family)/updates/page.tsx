import type { Metadata } from "next";
import { UpdatesList } from "@/components/family/updates-list";

export const metadata: Metadata = { title: "Updates" };

export default function UpdatesPage() {
  return <UpdatesList />;
}
