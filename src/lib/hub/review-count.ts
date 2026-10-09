import { db } from "@/db/client";
import { detectDuplicates } from "./duplicates";
import { countFamilyReports, countReviewQueues } from "./family-reports";

/**
 * Entries that wait for a second look plus open duplicates. This is the number on the Review tabs. Server only.
 *
 * Every hub page asks for it, so it is also where new duplicates are found: a
 * report or entry that just came in is flagged by the next hub page render,
 * and the badge never waits for someone to open the Duplicates tab.
 */
export function getReviewCount(): number {
  try {
    detectDuplicates(db);
  } catch (error) {
    // The badge still counts what is already flagged.
    console.error("duplicate detection failed", error);
  }
  const review = countReviewQueues(db);
  return review.second_look + review.duplicates;
}

/** Family reports nobody is assigned to yet. This is the number on the Family reports sidebar item. Server only. */
export function getUnassignedFamilyReportCount(): number {
  return countFamilyReports(db).not_assigned;
}
