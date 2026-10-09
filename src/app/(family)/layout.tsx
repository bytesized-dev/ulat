import { OfflineGate } from "@/components/family/offline-gate";

// The saved on phone screen and the service worker belong to the family pages.
// /hub and /r share the origin and the IndexedDB, so they must not mount the gate.
export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return <OfflineGate>{children}</OfflineGate>;
}
