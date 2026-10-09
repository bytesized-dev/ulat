"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/contracts";

// Creates the draft entry for this report, then opens capture. The server
// returns the draft that already exists if one was started on this house.
function StartAssessment({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report_code: code }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { id } = (await res.json()) as { id: string };
      router.push(routes.responder.assess(id));
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <>
      {failed ? (
        <p role="alert" className="mb-2 text-center text-body-sm text-danger">
          Could not start. Try again.
        </p>
      ) : null}
      <Button type="button" className="w-full" onClick={start} disabled={busy}>
        Start assessment
      </Button>
    </>
  );
}

export { StartAssessment };
