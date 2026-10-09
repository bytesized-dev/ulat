"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { askForPhotosAction } from "@/app/hub/review/actions";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/contracts/routes";
import { confirmEntry } from "@/lib/hub/api-client";
import type { ReviewAction } from "@/lib/hub/review";

type ReviewActionsProps = {
  entryId: string;
  approve: ReviewAction | null;
  useAi: ReviewAction | null;
  /** "2:51 PM" when staff already asked for photos. */
  askedAt: string | null;
};

const ERRORS = {
  unauthorized: "Sign in again to continue.",
  not_found: "This entry is gone.",
  failed: "Could not save. Try again.",
} as const;

// Approve and Use the AI class send EntryConfirm to PATCH /api/entries/[id], so
// the route confirms the entry, audits the fields and tells the other screens.
// Ask for photos is a server action that keeps the entry in review.
function ReviewActions({ entryId, approve, useAi, askedAt }: ReviewActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const disabled = busy || refreshing;

  async function settle(action: ReviewAction) {
    setError(null);
    setBusy(true);
    const result = await confirmEntry(entryId, action.body);
    setBusy(false);
    if (result !== "ok") return setError(ERRORS[result]);
    // The entry has left the list, so drop its id from the link.
    startRefresh(() => {
      router.replace(routes.hub.review);
      router.refresh();
    });
  }

  async function ask() {
    setError(null);
    setBusy(true);
    try {
      const result = await askForPhotosAction(entryId);
      if (!result.ok) return setError(result.error === "unauthorized" ? ERRORS.unauthorized : result.error === "not_found" ? ERRORS.not_found : ERRORS.failed);
      startRefresh(() => router.refresh());
    } catch {
      setError(ERRORS.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {approve ? (
          <Button type="button" size="hub" disabled={disabled} onClick={() => settle(approve)}>
            {approve.label}
          </Button>
        ) : null}
        {useAi ? (
          <Button type="button" size="hub" variant="secondary" disabled={disabled} onClick={() => settle(useAi)}>
            {useAi.label}
          </Button>
        ) : null}
        <Button type="button" size="hub" variant="secondary" disabled={disabled || askedAt !== null} onClick={ask}>
          {askedAt ? "Photos asked for" : "Ask for photos"}
        </Button>
      </div>
      {askedAt ? <p className="text-body-sm text-body">Asked for photos at {askedAt}.</p> : null}
      <p role="status" className="text-body-sm text-danger empty:hidden">
        {error}
      </p>
    </div>
  );
}

export { ReviewActions };
