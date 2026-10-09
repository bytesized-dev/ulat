import * as React from "react";
import { cn } from "@/lib/utils";
import { IconPlate } from "@/components/ui/icon-plate";

type HouseholdOptionProps = Omit<React.ComponentProps<"input">, "type" | "children"> & {
  icon: React.ReactNode;
  label: string;
};

// One choice in a radio group, drawn as a list row. The input is a real radio,
// hidden visually but still focusable, so the row works with a keyboard and a
// screen reader. The circle on the right shows its state.
function HouseholdOption({ icon, label, className, ...props }: HouseholdOptionProps) {
  return (
    <label
      data-slot="household-option"
      className={cn("flex min-h-16 w-full cursor-pointer items-center gap-4 border-b border-hairline-soft py-3 last:border-b-0", className)}
    >
      <IconPlate>{icon}</IconPlate>
      <span className="flex-1 text-title-sm text-ink">{label}</span>
      <input type="radio" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-soft transition-colors after:size-3 after:scale-0 after:rounded-full after:bg-primary after:transition-transform peer-checked:border-primary peer-checked:after:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
      />
    </label>
  );
}

export { HouseholdOption };
export type { HouseholdOptionProps };
