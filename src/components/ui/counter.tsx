import * as React from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CounterProps = Omit<React.ComponentProps<"div">, "onChange" | "children"> & {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

// The label sits on the left, the two round buttons and the number on the
// right. The buttons name the label, so "Fewer, Hurt" is read, not "Minus".
function Counter({ label, value, onChange, min = 0, max, className, ...props }: CounterProps) {
  const labelId = React.useId();
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

  return (
    <div
      data-slot="counter"
      role="group"
      aria-labelledby={labelId}
      className={cn("flex min-h-16 items-center justify-between gap-4", className)}
      {...props}
    >
      <span id={labelId} className="text-body-md font-medium text-ink">
        {label}
      </span>
      <div className="flex items-center">
        <Button type="button" variant="secondary" size="icon" aria-label={`Fewer, ${label}`} disabled={atMin} onClick={() => onChange(Math.max(min, value - 1))}>
          <MinusIcon aria-hidden="true" />
        </Button>
        <output aria-live="polite" className="w-10 text-center font-mono text-title-md font-medium text-ink tabular">
          {value}
        </output>
        <Button type="button" variant="secondary" size="icon" aria-label={`More, ${label}`} disabled={atMax} onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}>
          <PlusIcon aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export { Counter };
export type { CounterProps };
