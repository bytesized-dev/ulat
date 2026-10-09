"use client";

import { useEffect } from "react";
import { watchIdle } from "@/lib/hub/idle";
import { lockUrl } from "@/lib/hub/lock";

const staffAuthUrl = "/api/auth/staff";

/**
 * Locks the hub after 10 minutes with no input. Locking signs the staff cookie
 * out, then loads the lock screen with a full page load so no hub page stays in
 * the browser's cache. The lock screen sends staff back to this page.
 */
export function IdleLock() {
  useEffect(
    () =>
      watchIdle(async () => {
        const from = window.location.pathname + window.location.search;
        // The lock screen clears the cookie too, so a failed request still locks.
        await fetch(staffAuthUrl, { method: "DELETE" }).catch(() => null);
        window.location.replace(lockUrl(from));
      }),
    [],
  );
  return null;
}
