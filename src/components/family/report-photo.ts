// The photo a family picked for the report, kept in memory so the send screen
// can upload it. Like the voice note, a reload loses it and the report then
// goes without a photo. The check screen sets it, see BYTE-66.

let photo: Blob | null = null;

/** Keeps the photo the family just picked and drops the one before it. */
export function setReportPhoto(blob: Blob | null): void {
  photo = blob;
}

/** The photo itself, for the send screen. Null when there is none. */
export function reportPhotoBlob(): Blob | null {
  return photo;
}
