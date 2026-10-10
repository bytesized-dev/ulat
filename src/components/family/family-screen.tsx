import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

type FamilyScreenProps = React.ComponentProps<"div"> & {
  /** "screen" holds the panel to the window height, for a map that fills it. */
  fit?: "content" | "screen";
  /** Render the panel as the child element, so a form can be the screen. */
  asChild?: boolean;
};

// The phone column every family screen sits in. On a phone it is the whole
// window. From md up it becomes a white panel on the soft surface, so a laptop
// or tablet shows a deliberate card instead of a stretched phone.
function FamilyScreen({ fit = "content", asChild = false, className, ...props }: FamilyScreenProps) {
  const Panel = asChild ? Slot.Root : "div";
  return (
    <div className={cn("flex flex-col md:bg-surface-soft md:px-gutter md:py-10", fit === "screen" ? "h-dvh" : "min-h-dvh")}>
      <Panel
        data-slot="family-screen"
        // overflow-clip rounds the corners without making a scroll container,
        // so the sticky footers still stick to the window.
        className={cn(
          "mx-auto flex w-full max-w-prose flex-1 flex-col bg-canvas md:overflow-clip md:rounded-xl md:border md:border-hairline",
          fit === "screen" && "min-h-0",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export { FamilyScreen };
export type { FamilyScreenProps };
