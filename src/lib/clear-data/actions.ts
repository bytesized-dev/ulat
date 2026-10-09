"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { setSimulation } from "@/lib/auth/settings";
import { clearData, type ClearedCounts } from "./clear";

// Server actions for the Kit setup page. Anyone can post to an action, so each
// one checks for a staff session itself.

type Unauthorized = { ok: false; error: "unauthorized" };

export async function clearDataAction(): Promise<{ ok: true; cleared: ClearedCounts } | Unauthorized> {
  if ((await requireStaff()) instanceof Response) return { ok: false, error: "unauthorized" };
  const cleared = clearData();
  revalidatePath("/hub", "layout");
  return { ok: true, cleared };
}

export async function setSimulationAction(on: boolean): Promise<{ ok: true } | Unauthorized | { ok: false; error: "invalid" }> {
  if ((await requireStaff()) instanceof Response) return { ok: false, error: "unauthorized" };
  // The type is not enforced at runtime: a posted action argument can be anything.
  const parsed = z.boolean().safeParse(on);
  if (!parsed.success) return { ok: false, error: "invalid" };
  setSimulation(parsed.data);
  revalidatePath("/hub", "layout");
  return { ok: true };
}
