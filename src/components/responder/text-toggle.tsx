import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TextToggleProps = Omit<React.ComponentProps<"button">, "onClick" | "aria-pressed"> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  /** "underline" marks the chosen one of a few, "check" marks an on or off filter. */
  indicator: "underline" | "check";
};

// A toggle drawn as plain text, for rows that should not look like buttons.
// The chosen one is darker, and says so with a mark, not only with colour.
function TextToggle({ pressed, onPressedChange, indicator, className, children, ...props }: TextToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-sm text-body-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        pressed ? "text-ink" : "text-muted-text hover:text-ink",
        className,
      )}
      {...props}
    >
      {indicator === "check" && pressed ? <CheckIcon aria-hidden="true" className="size-4" /> : null}
      {children}
      {indicator === "underline" && pressed ? <span aria-hidden="true" className="absolute inset-x-0 bottom-1.5 h-0.5 rounded-pill bg-ink" /> : null}
    </button>
  );
}

export { TextToggle };
