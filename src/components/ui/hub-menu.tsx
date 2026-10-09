"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";
import { Dialog as DrawerPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";

// The hub sidebar on phones and tablets: a menu button that slides the same
// sidebar in from the left. The sidebar is rendered on the server and passed
// in as children.
function HubMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  // Hub pages share one shell, so the drawer survives a page change. Close it then.
  const [shownFor, setShownFor] = React.useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  return (
    <DrawerPrimitive.Root open={open} onOpenChange={setOpen}>
      <DrawerPrimitive.Trigger asChild>
        <Button variant="secondary" size="icon" aria-label="Menu" className="lg:hidden">
          <MenuIcon aria-hidden="true" />
        </Button>
      </DrawerPrimitive.Trigger>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/50 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DrawerPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-sidebar max-w-full flex-col overflow-y-auto border-r border-hairline bg-canvas p-3 text-ink outline-none duration-200 ease-in-out data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left"
        >
          <DrawerPrimitive.Title className="sr-only">Menu</DrawerPrimitive.Title>
          <DrawerPrimitive.Close asChild>
            <Button variant="secondary" size="icon" aria-label="Close menu" className="absolute top-3 right-3">
              <XIcon aria-hidden="true" />
            </Button>
          </DrawerPrimitive.Close>
          {children}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

export { HubMenu };
