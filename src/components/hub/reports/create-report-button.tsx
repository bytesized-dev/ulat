"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Snapshots the totals with POST /api/sitreps, then reloads the page to show the new report. */
export function CreateReportButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function create() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/sitreps", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {failed ? (
        <p role="alert" className="text-body-sm text-danger">
          Could not create the report. Try again.
        </p>
      ) : null}
      <Button size="hub" onClick={create} disabled={busy}>
        {busy ? "Creating" : "Create report"}
      </Button>
    </div>
  );
}
