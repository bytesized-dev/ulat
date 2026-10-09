import * as React from "react";
import { cn } from "@/lib/utils";

const steps = ["Household", "Details", "Check", "Send"] as const;

type Step = 1 | 2 | 3 | 4;

// Full class names, so Tailwind sees each one.
const fill: Record<Step, string> = {
  1: "w-1/4",
  2: "w-1/2",
  3: "w-3/4",
  4: "w-full",
};

type ProgressStepsProps = Omit<React.ComponentProps<"div">, "children"> & {
  step: Step;
};

// A 4px track filled to step/4, then the four labels. The track is decoration.
// The list says where you are: the current label is aria-current="step" and a
// hidden line gives "Step 3 of 4".
function ProgressSteps({ step, className, ...props }: ProgressStepsProps) {
  return (
    <div data-slot="progress-steps" className={cn("flex flex-col gap-2", className)} {...props}>
      <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-pill bg-surface-strong">
        <div className={cn("h-full rounded-pill bg-primary", fill[step])} />
      </div>
      <p className="sr-only">{`Step ${step} of ${steps.length}.`}</p>
      <ol className="grid grid-cols-4 text-caption-strong">
        {steps.map((label, index) => {
          const position = index + 1;
          const current = position === step;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={cn(current ? "font-semibold text-ink" : position < step ? "font-medium text-body" : "font-medium text-muted-soft")}
            >
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export { ProgressSteps };
export type { ProgressStepsProps, Step };
