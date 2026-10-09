import type { ReportDraft } from "./report-draft";

// The pure part of step 1: which required field is still empty. The form only
// shows what this says.

export type StartField = "household_head" | "barangay" | "reporter_name";

export type StartError = { field: StartField; message: string };

/**
 * The first required field with nothing in it, in the order the screen shows
 * them, or null when the family can continue. A barangay counts only when it is
 * still on the hub's list, because that is the one the picker shows.
 */
export function firstMissing(draft: ReportDraft, barangays: string[]): StartError | null {
  const neighbor = draft.source === "neighbor";
  if (draft.household_head.trim() === "") {
    return { field: "household_head", message: neighbor ? "Enter the neighbor's name" : "Enter the head of household" };
  }
  if (!barangays.includes(draft.barangay)) return { field: "barangay", message: "Choose a barangay" };
  if (neighbor && draft.reporter_name.trim() === "") return { field: "reporter_name", message: "Enter your name" };
  return null;
}
