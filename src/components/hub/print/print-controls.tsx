"use client";

import Link from "next/link";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

type PrintControlsProps = {
  /** Where Back goes. */
  backHref: string;
};

/** The bar above the sheet. It is hidden when the page prints. */
export function PrintControls({ backHref }: PrintControlsProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-8 py-4 print:hidden">
      <Link href={backHref} className={buttonVariants({ variant: "secondary", size: "hub" })}>
        <ArrowLeftIcon aria-hidden="true" />
        Back
      </Link>
      <Button size="hub" onClick={() => window.print()}>
        <PrinterIcon aria-hidden="true" />
        Print
      </Button>
    </div>
  );
}
