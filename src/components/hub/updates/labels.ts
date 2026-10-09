import type { z } from "zod";
import type { UpdateType } from "@/lib/contracts";
import type { StatusDotTone } from "@/components/ui/status-dot";

type Type = z.infer<typeof UpdateType>;

/** The type control on the form. */
export const updateTypeOptions: { value: Type; label: string }[] = [
  { value: "water_food", label: "Water and food" },
  { value: "shelter", label: "Shelter" },
  { value: "hazard", label: "Hazard" },
  { value: "notice", label: "Notice" },
];

/** The short pill on the posted list. Hazard has no tone: its dot is ink. */
export const updateTypePill: Record<Type, { label: string; dot?: StatusDotTone }> = {
  water_food: { label: "Water", dot: "primary" },
  shelter: { label: "Shelter", dot: "muted-soft" },
  hazard: { label: "Hazard" },
  notice: { label: "Notice", dot: "muted-soft" },
};
