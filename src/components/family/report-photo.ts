// The photo a family picked for the report, as the send screen and the saved on
// phone screen see it. It is kept in IndexedDB by report-photo-store.ts, so a
// reload, Back and Continue keep it, and these two calls are the way in and out.
// The check screen sets it, see BYTE-66.

import { clearReportPhoto, getPhotoSnapshot, keepReportPhoto } from "./report-photo-store";

/** Keeps the photo the family just picked in place of the one before it, or drops it when null. */
export function setReportPhoto(blob: Blob | null): void {
  void (blob ? keepReportPhoto(blob) : clearReportPhoto());
}

/** The photo itself, for the send screen. Null when there is none. Await loadReportPhoto first after a reload. */
export function reportPhotoBlob(): Blob | null {
  return getPhotoSnapshot().photo;
}
