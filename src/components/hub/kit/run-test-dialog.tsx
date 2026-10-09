"use client";

import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// The AI check page only reads eval/results.json. It never calls the model, so
// Run test explains how to run the test on the hub instead of starting one.
export function RunTestDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="hub">
          <RefreshCwIcon aria-hidden="true" />
          Run test
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-title-md">Run the AI check</DialogTitle>
          <DialogDescription>This page does not run the model. To run the test, start Ollama on this laptop, open a terminal in the Ulat folder and enter:</DialogDescription>
        </DialogHeader>
        <code className="rounded-md bg-surface-strong px-3 py-2 font-mono text-mono-sm text-ink">pnpm eval</code>
        <p className="text-body-sm text-body">When it finishes, reload this page to see the new numbers.</p>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
