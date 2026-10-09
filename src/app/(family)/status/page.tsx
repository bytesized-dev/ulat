import { Suspense } from "react";
import type { Metadata } from "next";
import { StatusScreen } from "@/components/family/status-screen";

export const metadata: Metadata = { title: "My report" };

// StatusScreen reads ?code=, which a page cannot know when it is built, so it
// sits in Suspense.
export default function StatusPage() {
  return (
    <Suspense>
      <StatusScreen />
    </Suspense>
  );
}
