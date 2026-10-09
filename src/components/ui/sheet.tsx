"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

// A 50% ink scrim and nothing else. No blur, no shadow.
function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-ink/50 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

type SheetContentProps = Omit<React.ComponentProps<typeof SheetPrimitive.Content>, "title"> & {
  /** The heading in the title row. It also names the dialog for screen readers. */
  title: string;
};

// A bottom sheet: 24px top corners, a handle, then a title row with a
// labelled close button. Whatever the sheet holds goes in children.
function SheetContent({ title, className, children, ...props }: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        // Radix warns when there is no description. A sheet's title is enough.
        aria-describedby={undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-11/12 w-full max-w-prose flex-col overflow-y-auto rounded-t-xl bg-canvas text-ink outline-none duration-200 ease-in-out data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-10",
          className,
        )}
        {...props}
      >
        <div aria-hidden="true" className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-pill bg-hairline" />
        <div className="flex shrink-0 items-center justify-between gap-4 px-gutter pt-2 pb-2">
          <SheetPrimitive.Title data-slot="sheet-title" className="text-title-md text-ink">
            {title}
          </SheetPrimitive.Title>
          <SheetPrimitive.Close asChild>
            <Button variant="secondary" size="icon" aria-label="Close">
              <XIcon aria-hidden="true" />
            </Button>
          </SheetPrimitive.Close>
        </div>
        <div className="flex flex-col gap-4 px-gutter pb-6">{children}</div>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetFooter };
export type { SheetContentProps };
