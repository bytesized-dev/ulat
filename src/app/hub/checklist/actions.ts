"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { requireStaff } from "@/lib/auth/session";
import { routes } from "@/lib/contracts/routes";
import { ChecklistItemIdSchema, setChecklistItem } from "@/lib/hub/checklist";

// The Before the storm list writes through this one action. Anyone can post to
// an action, so it checks for a staff session itself and checks its arguments,
// which arrive from a browser whatever the types say.

const Tick = z.object({ id: ChecklistItemIdSchema, done: z.boolean() });

export type ChecklistActionResult =
  | { ok: true; done: number; total: number }
  | { ok: false; error: "unauthorized" | "invalid" };

export async function setChecklistItemAction(id: string, done: boolean): Promise<ChecklistActionResult> {
  if ((await requireStaff()) instanceof Response) return { ok: false, error: "unauthorized" };
  const tick = Tick.safeParse({ id, done });
  if (!tick.success) return { ok: false, error: "invalid" };
  const list = setChecklistItem(db, tick.data.id, tick.data.done);
  revalidatePath(routes.hub.checklist);
  return { ok: true, done: list.done, total: list.total };
}
