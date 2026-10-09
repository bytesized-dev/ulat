"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { askForPhotosAction } from "@/app/hub/review/actions";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/contracts/routes";
import { confirmEntry } from "@/lib/hub/api-client";
import type { ReviewAction } from "@/lib/hub/review";
import { SETTLED_PARAM } from "@/lib/hub/review-refresh";

type ReviewActionsProps = {
  entryId: string;
  approve: ReviewAction | null;
  useAi: ReviewAction | null;
  /** The responder's name, for the line after Ask for photos. */
  responderName: string;
  /** "2:51 PM" when staff already noted an ask for photos that still stands. */
  askedAt: string | null;
};

const ERRORS = {
  unauthorized: "Sign in again to continue.",
  not_found: "This entry is gone.",
  failed: "Could not save. Try again.",
} as const;

// Approve and Use the AI class send EntryConfirm to PATCH /api/entries/[id], so
// the route confirms the entry, audits the fields and tells the other screens.
// Ask for photos is a server action that keeps the entry in review and notes the
// ask in the audit trail. Nothing tells the responder yet, so the page says to.
function ReviewActions({ entryId, approve, useAi, responderName, askedAt }: ReviewActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const disabled = busy || refreshing;

  // Someone else settled it, so this tab is out of date. The page says so above the
  // list, since the entry may be gone from it, and shows what is true now.
  function showSettled() {
    startRefresh(() => {
      router.replace(`${routes.hub.review}?${SETTLED_PARAM}=1`);
      router.refresh();
    });
  }

  async function settle(action: ReviewAction) {
    setError(null);
    setBusy(true);
    const result = await confirmEntry(entryId, action.body);
    setBusy(false);
    if (result === "settled") return showSettled();
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
      if (!result.ok) {
        if (result.error === "not_in_review") return showSettled();
        if (result.error === "not_found") startRefresh(() => router.refresh());
        return setError(result.error === "unauthorized" ? ERRORS.unauthorized : result.error === "not_found" ? ERRORS.not_found : ERRORS.failed);
      }
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
          Ask for photos
        </Button>
      </div>
      {askedAt ? (
        <p className="text-body-sm text-body">
          Noted at {askedAt}. Tell {responderName} by radio or text.
        </p>
      ) : null}
      <p role="status" className="text-body-sm text-danger empty:hidden">
        {error}
      </p>
    </div>
  );
}

export { ReviewActions };
