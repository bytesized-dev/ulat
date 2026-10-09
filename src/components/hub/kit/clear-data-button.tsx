"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { clearDataAction } from "@/lib/clear-data/actions";

/** Clear data, with a question first. It wipes every report, entry, photo and update, and it cannot be undone. */
export function ClearDataButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();

  function clear() {
    startTransition(async () => {
      const result = await clearDataAction();
      setOpen(false);
      setMessage(result.ok ? { text: "Simulation data cleared.", tone: "ok" } : { text: "Not cleared. Lock the hub and sign in again.", tone: "error" });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="hub" className="self-start text-danger">
            Clear data
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all data?</DialogTitle>
            <DialogDescription>This removes every report, entry, photo and update. It cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" size="hub" onClick={() => setOpen(false)}>
              Keep data
            </Button>
            <Button variant="primary" size="hub" disabled={pending} onClick={clear}>
              Clear data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {message ? (
        <p role="status" className={message.tone === "error" ? "text-body-sm text-danger" : "text-body-sm text-body"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
