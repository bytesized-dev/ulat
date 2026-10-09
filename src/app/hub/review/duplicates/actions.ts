"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emit } from "@/app/api/reports/_lib/audit";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/auth/session";
import { mergeDuplicate, resolveDuplicate } from "@/lib/hub/duplicates";

// Server actions for the Duplicates screen (BYTE-32). Anyone can post to an
// action, so each one checks for a staff session itself and parses what it was
// given: an action argument is only typed at compile time.

export type DuplicateActionResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "not_found" | "already_resolved" | "not_mergeable" | "already_merged" };

const PairId = z.string().uuid();
const Resolution = z.enum(["kept", "mistake"]);

/** The Review badge and every open Review tab show the new counts. */
const refresh = () => revalidatePath("/hub", "layout");

/** Merges the later report into the first. Both families keep a code that resolves. */
export async function mergeDuplicateAction(id: unknown): Promise<DuplicateActionResult> {
  if ((await requireStaff()) instanceof Response) return { ok: false, error: "unauthorized" };
  const pair = PairId.safeParse(id);
  if (!pair.success) return { ok: false, error: "invalid" };

  const result = mergeDuplicate(db, pair.data, "staff");
  if (!result.ok) return result;
  // The transaction is committed, so the live streams hear about it now.
  for (const event of result.events) emit(event);
  refresh();
  return { ok: true };
}

/** Keep both reports, or call one of them a mistake. Only the pair is resolved. */
export async function resolveDuplicateAction(id: unknown, resolution: unknown): Promise<DuplicateActionResult> {
  if ((await requireStaff()) instanceof Response) return { ok: false, error: "unauthorized" };
  const pair = PairId.safeParse(id);
  const status = Resolution.safeParse(resolution);
  if (!pair.success || !status.success) return { ok: false, error: "invalid" };

  const result = resolveDuplicate(db, pair.data, status.data, "staff");
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}
