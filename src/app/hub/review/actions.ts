"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/auth/session";
import { routes } from "@/lib/contracts/routes";
import { askForPhotos, type AskForPhotosResult } from "@/lib/hub/review";

// Anyone can post to a server action, so this one checks for a staff session
// itself and validates its argument. Approve does not live
// here: it goes through PATCH /api/entries/[id], which audits and emits.

export type AskForPhotosActionResult = AskForPhotosResult | { ok: false; error: "unauthorized" | "invalid" };

export async function askForPhotosAction(entryId: string): Promise<AskForPhotosActionResult> {
  if ((await requireStaff()) instanceof Response) return { ok: false, error: "unauthorized" };
  // The type is not enforced at runtime: a posted action argument can be anything.
  const id = z.string().uuid().safeParse(entryId);
  if (!id.success) return { ok: false, error: "invalid" };
  const result = askForPhotos(db, id.data);
  if (result.ok) revalidatePath(routes.hub.review);
  return result;
}
