import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TimelineState = "done" | "current" | "upcoming";

type TimelineItem = {
  label: string;
  /** Shown on the right in mono, for example "2:48 PM". */
  time?: string;
  state: TimelineState;
};

type TimelineProps = Omit<React.ComponentProps<"ol">, "children"> & {
  items: TimelineItem[];
};

const stateText: Record<TimelineState, string> = {
  done: "Done",
  current: "Now",
  upcoming: "Next",
};

function Marker({ state }: { state: TimelineState }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full",
        state === "done" && "bg-ink text-canvas",
        state === "current" && "border-2 border-primary bg-canvas",
        state === "upcoming" && "border-2 border-hairline bg-canvas",
      )}
    >
      {state === "done" ? <CheckIcon className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

function Timeline({ items, className, ...props }: TimelineProps) {
  return (
    <ol data-slot="timeline" className={cn("flex flex-col", className)} {...props}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <li key={`${item.label}-${index}`} aria-current={item.state === "current" ? "step" : undefined} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Marker state={item.state} />
              {last ? null : <span aria-hidden="true" className="w-px flex-1 bg-hairline" />}
            </div>
            <div className={cn("flex min-w-0 flex-1 items-start justify-between gap-4", last ? "" : "pb-5")}>
              <span className={cn("text-body-md", item.state === "upcoming" ? "text-muted-soft" : "text-ink", item.state === "current" && "font-semibold")}>
                <span className="sr-only">{`${stateText[item.state]}: `}</span>
                {item.label}
              </span>
              {item.time ? <span className="shrink-0 font-mono text-mono-sm text-body tabular">{item.time}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export { Timeline };
export type { TimelineItem, TimelineProps, TimelineState };
