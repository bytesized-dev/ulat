import { z } from "zod";
import { SafeCheckin } from "@/lib/contracts";

// The check-in a family has just made, for the confirmation screen, and the
// requests to the hub for checking in and for finding someone. The screens only
// wire them to the page.

export const SAFE_KEY = "ulat.safe-checkin";
/** The hub returns nothing for a shorter search, so the screen does not ask. */
export const MIN_SEARCH = 2;

export const CheckedIn = SafeCheckin.pick({ name: true, staying_at: true });
export type CheckedIn = z.infer<typeof CheckedIn>;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

// What this page load saved, for a browser that refuses to store anything.
let remembered: string | null = null;

export function readCheckedInRaw(store: Store | null = browserStore()): string | null {
  try {
    return store?.getItem(SAFE_KEY) ?? remembered;
  } catch {
    return remembered;
  }
}

export function parseCheckedIn(raw: string | null): CheckedIn | null {
  if (!raw) return null;
  try {
    const parsed = CheckedIn.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveCheckedIn(value: CheckedIn, store: Store | null = browserStore()): void {
  remembered = JSON.stringify(value);
  try {
    store?.setItem(SAFE_KEY, remembered);
  } catch {
    // The confirmation still shows from memory for this page load.
  }
}

export type SafeForm = { name: string; barangay: string; staying_at: string; message: string };

/** The form as a SafeCheckin from a phone. An empty message is sent as null. */
export function toCheckin(form: SafeForm) {
  return SafeCheckin.safeParse({
    name: form.name.trim(),
    barangay: form.barangay,
    staying_at: form.staying_at,
    message: form.message.trim() === "" ? null : form.message.trim(),
    source: "phone",
  });
}

export type CheckinResult = { ok: true } | { ok: false; message: string };

const UNREACHABLE = "Could not reach the hub. Check the Wi-Fi and try again.";

/** Posts the check-in. Never throws. */
export async function sendCheckin(form: SafeForm, send: typeof fetch = fetch): Promise<CheckinResult> {
  const body = toCheckin(form);
  if (!body.success) return { ok: false, message: "Add your name, barangay and where you are staying." };
  try {
    const res = await send("/api/safe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.data),
    });
    if (res.ok) return { ok: true };
    if (res.status === 400) return { ok: false, message: "We could not add you. Check your answers." };
    return { ok: false, message: "The hub could not save this. Try again." };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

// GET /api/safe?q= returns these four fields and never the message.
const Found = z.object({
  name: z.string().min(1),
  barangay: z.string(),
  staying_at: z.string(),
  at: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
});
export type Found = z.infer<typeof Found>;

/** The people in a GET /api/safe body. Items that do not fit are skipped, and nothing but the four public fields is kept. */
export function parseFound(body: unknown): Found[] {
  const list = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(list)) return [];
  const found: Found[] = [];
  for (const item of list) {
    const parsed = Found.safeParse(item);
    if (parsed.success) found.push(parsed.data);
  }
  return found;
}

export function searchUrl(query: string): string | null {
  const q = query.trim();
  return q.length >= MIN_SEARCH ? `/api/safe?q=${encodeURIComponent(q)}` : null;
}

/** "EB" for Ernesto Bautista. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}
