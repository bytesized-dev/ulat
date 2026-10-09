"use client";

import { useState, useTransition } from "react";
import { mergeDuplicateAction, resolveDuplicateAction, type DuplicateActionResult } from "@/app/hub/review/duplicates/actions";
import { Button } from "@/components/ui/button";

type DuplicateActionsProps = {
  pairId: string;
  /** The first report's code, which the merged household keeps. Null when the pair cannot be merged. */
  mergeInto: string | null;
  /** The later side, named on the mistake button: a report code or an entry number. */
  later: string;
};

const ERRORS: Record<Extract<DuplicateActionResult, { ok: false }>["error"], string> = {
  unauthorized: "Sign in again to continue.",
  invalid: "Could not read this pair. Reload the page.",
  not_found: "This pair is gone.",
  already_resolved: "Someone already handled this pair.",
  not_mergeable: "A report and an entry cannot be merged.",
  already_merged: "One of these reports is already merged.",
};

// Merge, keep both, or call the later one a mistake. Each runs a server action,
// which refreshes the page, so the next pair comes up by itself.
function DuplicateActions({ pairId, mergeInto, later }: DuplicateActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<DuplicateActionResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(ERRORS[result.error]);
      } catch {
        setError("The hub did not answer. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {mergeInto ? (
          <Button size="hub" disabled={pending} onClick={() => run(() => mergeDuplicateAction(pairId))}>
            Merge into {mergeInto}
          </Button>
        ) : null}
        <Button size="hub" variant="secondary" disabled={pending} onClick={() => run(() => resolveDuplicateAction(pairId, "kept"))}>
          Keep both
        </Button>
        <Button size="hub" variant="secondary" disabled={pending} onClick={() => run(() => resolveDuplicateAction(pairId, "mistake"))}>
          {later} is a mistake
        </Button>
      </div>
      <p role="status" className="text-body-sm text-danger empty:hidden">
        {error}
      </p>
    </div>
  );
}

export { DuplicateActions };
