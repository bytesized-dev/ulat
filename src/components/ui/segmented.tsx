import * as React from "react";
import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedProps<T extends string> = Omit<React.ComponentProps<"div">, "onChange" | "children" | "role"> & {
  /** Names the group for screen readers, and groups the radios. */
  "aria-label": string;
  name: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  size?: "phone" | "hub";
};

// Real radio inputs, so arrow keys and form posts work. The radio is hidden
// and its label is drawn as the segment.
function Segmented<T extends string>({ name, options, value, onValueChange, size = "hub", className, ...props }: SegmentedProps<T>) {
  return (
    <div data-slot="segmented" role="radiogroup" className={cn("inline-flex gap-1 rounded-pill bg-surface-strong p-1", className)} {...props}>
      {options.map((option) => (
        <label key={option.value} className={cn("hit relative flex items-center justify-center rounded-pill", size === "phone" ? "h-11" : "h-9")}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onValueChange(option.value)}
            className="peer sr-only"
          />
          <span className="flex h-full items-center rounded-pill px-4 text-body-sm font-semibold text-body transition-colors peer-checked:bg-surface-dark peer-checked:text-canvas peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export { Segmented };
export type { SegmentedOption, SegmentedProps };
