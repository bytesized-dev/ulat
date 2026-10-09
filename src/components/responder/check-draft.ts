import { type AiPhotoDraft, EntryConfirm } from "@/lib/contracts";
import type { StatusDotTone } from "@/components/ui/status-dot";

// Pure helpers for the drafting, check and confirmed screens, kept apart so they can be tested.

type DamageClass = EntryConfirm["damage_class"];
type MaterialValue = EntryConfirm["material"];
type NeedValue = EntryConfirm["needs"][number];
type ConfidenceValue = AiPhotoDraft["confidence"];

export const CLASS_OPTIONS: { value: DamageClass; label: string }[] = [
  { value: "none", label: "No damage" },
  { value: "partial", label: "Partially damaged" },
  { value: "total", label: "Totally damaged" },
];

export const CLASS_TONE: Record<DamageClass, StatusDotTone> = { none: "success", partial: "warning", total: "danger" };

/** The short class name on the confirmed screen. */
export const CLASS_SHORT: Record<DamageClass, string> = { none: "No damage", partial: "Partially", total: "Totally" };

export const MATERIAL_OPTIONS: { value: MaterialValue; label: string }[] = [
  { value: "light", label: "Light materials" },
  { value: "mixed", label: "Mixed" },
  { value: "concrete", label: "Concrete" },
];

export const NEED_OPTIONS: { value: NeedValue; label: string }[] = [
  { value: "water", label: "Water" },
  { value: "tarp", label: "Tarp" },
  { value: "medicine", label: "Medicine" },
  { value: "food", label: "Food" },
  { value: "hygiene_kit", label: "Hygiene kit" },
  { value: "baby_needs", label: "Baby needs" },
];

/** Hazards the responder can add with one tap. Anything else is typed. */
export const HAZARD_SUGGESTIONS = ["Fallen power line", "Flooding", "Landslide risk", "Leaning wall"] as const;

/** SPEC section 5: high is "Fairly sure", medium and low are "Not very sure". */
export function confidenceWords(confidence: ConfidenceValue | null): string {
  return confidence === "high" ? "Fairly sure" : "Not very sure";
}

export type AiDraft = {
  damage_class: AiPhotoDraft["damage_class"] | null;
  confidence: ConfidenceValue | null;
  reason: string | null;
  need_more: string | null;
};

/** Any non-null ai_class means the draft is done, whether it arrived in the GET or after entry.drafted. */
export function isDrafted(ai: Pick<AiDraft, "damage_class">): boolean {
  return ai.damage_class !== null;
}

export function isUnclear(ai: Pick<AiDraft, "damage_class">): boolean {
  return ai.damage_class === "unclear";
}

export type CheckForm = {
  damage_class: DamageClass | null;
  material: MaterialValue;
  hazards: string[];
  families: number;
  people: number;
  hurt: number;
  missing: number;
  needs: NeedValue[];
};

type EntryFields = {
  damage_class: DamageClass | null;
  material: MaterialValue | null;
  hazards: string[];
  families: number;
  people: number;
  hurt: number;
  missing: number;
  needs: NeedValue[];
};

/**
 * The form starts from what the hub drafted. The class starts selected only when the AI
 * was sure, so an unclear draft makes the responder choose.
 */
export function initialForm(entry: EntryFields, ai: Pick<AiDraft, "damage_class">): CheckForm {
  const suggested = ai.damage_class && ai.damage_class !== "unclear" ? ai.damage_class : null;
  return {
    damage_class: entry.damage_class ?? suggested,
    material: entry.material ?? "unknown",
    hazards: entry.hazards,
    families: entry.families,
    people: entry.people,
    hurt: entry.hurt,
    missing: entry.missing,
    needs: entry.needs,
  };
}

/** Confirm stays off until a class is chosen. */
export function canConfirm(form: Pick<CheckForm, "damage_class">): boolean {
  return form.damage_class !== null;
}

/** Checks the form against the shared contract. Null while no class is chosen. */
export function buildConfirm(form: CheckForm, newPhotoSinceUnclear: boolean) {
  if (form.damage_class === null) return null;
  return EntryConfirm.safeParse({ ...form, new_photo_since_unclear: newPhotoSinceUnclear });
}

/** "Matches report" shows when the hurt count equals the family report. Nothing shows without a report. */
/**
 * True when a failed save means the entry moved on while the screen was open: the
 * route answered 409 not_a_draft. Retrying cannot work, so the screen goes to the confirmed page.
 */
export async function entryMovedOn(res: Pick<Response, "status" | "json">): Promise<boolean> {
  if (res.status !== 409) return false;
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return body?.error === "not_a_draft";
}

export function matchesReport(hurt: number, reportHurt: number | null): boolean {
  return reportHurt !== null && hurt === reportHurt;
}

export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** 5 people, 1 hurt. Hurt is left out when nobody is hurt. */
export function peopleLine(people: number, hurt: number): string {
  const p = `${people} ${people === 1 ? "person" : "people"}`;
  return hurt > 0 ? `${p}, ${hurt} hurt` : p;
}

/** The tag on the next urgent row, or null when the house is not urgent. */
export function urgencyLabel(hurt: number, missing: number): string | null {
  if (missing > 0) return `${missing} missing`;
  if (hurt > 0) return `${hurt} hurt`;
  return null;
}

export type DraftStep = { label: string; state: "done" | "active" | "waiting" };

/** The four rows on the drafting screen. The hub gives no step by step progress, so the model step runs until the draft lands. */
export function draftSteps(input: { photos: number; hasNote: boolean; drafted: boolean }): DraftStep[] {
  const { photos, hasNote, drafted } = input;
  const received = `${photos} ${photos === 1 ? "photo" : "photos"}${hasNote ? " and a note" : ""}`;
  const steps: DraftStep[] = [{ label: received, state: "done" }];
  if (hasNote) steps.push({ label: "Note understood", state: "done" });
  steps.push({ label: "Reading the photos", state: drafted ? "done" : "active" });
  steps.push({ label: "Filling in the entry", state: drafted ? "done" : "waiting" });
  return steps;
}
