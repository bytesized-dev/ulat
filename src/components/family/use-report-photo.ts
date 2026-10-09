"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getPhotoSnapshot, NO_PHOTO, subscribePhoto, type PhotoSnapshot } from "./report-photo-store";

/** The report's photo, empty on the server and until it is read from IndexedDB. */
export function useReportPhoto(): PhotoSnapshot {
  return useSyncExternalStore(subscribePhoto, getPhotoSnapshot, () => NO_PHOTO);
}

/** An address a thumbnail can show for the photo, let go of when the photo changes. */
export function usePhotoUrl(photo: Blob | null): string | null {
  const [made, setMade] = useState<{ photo: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    // Set once the address exists, which is outside React, so this is a sync with it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMade({ photo, url });
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  // An address for an earlier photo is never shown for this one.
  return photo && made?.photo === photo ? made.url : null;
}
