import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db/client";
import { settings } from "../../db/schema";
import { routes } from "../contracts/routes";

// The Before the storm list. SPEC section 1 has staff do these while the hub
// still has internet. The ticks live in one settings row, as a JSON list of the
// item ids that are done. Callers pass the database so tests can use their own file.

export const CHECKLIST_KEY = "kit_checklist";

type ChecklistLink = { label: string; href: string; variant: "secondary" | "primary" };

/** The eight items, in the order of the screen. Labels and button words are the screen's. */
export const CHECKLIST_ITEMS = [
  { id: "town_map", label: "Download the town map", link: { label: "Update", href: `${routes.hub.setup}#map`, variant: "secondary" } },
  { id: "ai_model", label: "Load the AI model", link: null },
  { id: "certificate", label: "Get the web certificate", link: null },
  { id: "responders", label: "Add responders and PIN", link: { label: "Manage", href: `${routes.hub.setup}#responders`, variant: "secondary" } },
  { id: "places", label: "Mark shelters and relief", link: { label: "Map", href: routes.hub.mapAdd, variant: "secondary" } },
  { id: "ai_check", label: "Run the AI check", link: { label: "Run", href: routes.hub.aiCheck, variant: "primary" } },
  { id: "poster", label: "Print the join poster", link: { label: "Print", href: routes.hub.poster, variant: "primary" } },
  { id: "drill", label: "Run a drill", link: { label: "Start", href: routes.hub.setup, variant: "primary" } },
] as const satisfies readonly { id: string; label: string; link: ChecklistLink | null }[];

export type ChecklistItemId = (typeof CHECKLIST_ITEMS)[number]["id"];

const itemIds = CHECKLIST_ITEMS.map((item) => item.id) as [ChecklistItemId, ...ChecklistItemId[]];

/** An item id as it arrives from a browser. Anything else is rejected. */
export const ChecklistItemIdSchema = z.enum(itemIds);

const StoredDone = z.array(z.string());

export type ChecklistView = {
  items: { id: ChecklistItemId; label: string; link: ChecklistLink | null; done: boolean }[];
  done: number;
  total: number;
};

function readDoneIds(db: Db): Set<string> {
  const row = db.select({ value: settings.value }).from(settings).where(eq(settings.key, CHECKLIST_KEY)).get();
  if (!row) return new Set();
  try {
    const parsed = StoredDone.safeParse(JSON.parse(row.value));
    // A row that does not match reads as nothing done. The next write replaces it.
    return parsed.success ? new Set(parsed.data) : new Set();
  } catch {
    return new Set();
  }
}

/** Every item with its ticked state, and the counts the page shows. Ids in the row that are no longer items are ignored. */
export function readChecklist(db: Db): ChecklistView {
  const doneIds = readDoneIds(db);
  const items = CHECKLIST_ITEMS.map((item) => ({ ...item, done: doneIds.has(item.id) }));
  return { items, done: items.filter((item) => item.done).length, total: items.length };
}

/** Ticks or unticks one item and keeps the rest. Returns the list as stored. */
export function setChecklistItem(db: Db, id: ChecklistItemId, done: boolean): ChecklistView {
  const doneIds = readDoneIds(db);
  if (done) doneIds.add(id);
  else doneIds.delete(id);
  // Stored in the order of the screen, so the row reads the same whatever order the ticks came in.
  const value = JSON.stringify(CHECKLIST_ITEMS.filter((item) => doneIds.has(item.id)).map((item) => item.id));
  db.insert(settings).values({ key: CHECKLIST_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
  return readChecklist(db);
}
