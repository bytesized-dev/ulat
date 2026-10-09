import { db } from "@/db/client";
import { countReviewQueues } from "./family-reports";

/** Entries that wait for a second look plus open duplicates. This is the number on the Review tabs. Server only. */
export function getReviewCount(): number {
  const review = countReviewQueues(db);
  return review.second_look + review.duplicates;
}
