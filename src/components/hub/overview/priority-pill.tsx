import type { BarangayRow } from "@/lib/contracts";
import { Pill } from "@/components/ui/pill";
import type { StatusDotTone } from "@/components/ui/status-dot";

const PRIORITY: Record<BarangayRow["priority"], { label: string; dot: StatusDotTone }> = {
  high: { label: "High", dot: "danger" },
  medium: { label: "Medium", dot: "warning" },
  low: { label: "Low", dot: "muted-soft" },
};

export function PriorityPill({ priority }: { priority: BarangayRow["priority"] }) {
  const { label, dot } = PRIORITY[priority];
  return <Pill dot={dot}>{label}</Pill>;
}
