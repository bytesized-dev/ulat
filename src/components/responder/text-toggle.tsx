import * as React from "react";
import { cn } from "@/lib/utils";

type TextToggleProps = Omit<React.ComponentProps<"button">, "onClick" | "aria-pressed"> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
};

// A toggle drawn as plain text, for rows that should not look like buttons.
// The chosen one is darker and has an underline, so it is not only the colour.
function TextToggle({ pressed, onPressedChange, className, children, ...props }: TextToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "relative inline-flex h-11 shrink-0 items-center rounded-sm text-body-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        pressed ? "text-ink" : "text-muted-text hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
      {pressed ? <span aria-hidden="true" className="absolute inset-x-0 bottom-1.5 h-0.5 rounded-pill bg-ink" /> : null}
    </button>
  );
}

export { TextToggle };
