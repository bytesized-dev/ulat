import type { AiPhotoDraft, EntryConfirm } from "@/lib/contracts";
import type { StatusDotTone } from "@/components/ui/status-dot";
import { type AssessmentFields, reportClass } from "@/lib/reports/assessment";

// Pure helpers for the assess and confirmed screens, kept apart so they can be tested.
// No AI reads a responder's photos. The form starts from the family report and the
// hub's reading of the family's photo, and the responder changes what they find different.

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

/** The responder's answers on the assess screen. The class stays null until someone picks one. */
export type EntryForm = Omit<EntryConfirm, "damage_class"> & { damage_class: DamageClass | null };

/** Where the assess screen starts. A house with no report starts empty. */
export type EntryStart = Partial<EntryForm>;

/** Who suggested the class the form starts with. Null when the responder picks it. */
export type ClassFrom = "staff" | "photo" | null;

export function initialForm(start: EntryStart = {}): EntryForm {
  return {
    damage_class: start.damage_class ?? null,
    material: start.material ?? "unknown",
    // The model sometimes lists "none" as a hazard. It means there are none.
    hazards: (start.hazards ?? []).filter((h) => h.trim().toLowerCase() !== "none"),
    families: start.families ?? 1,
    people: start.people ?? 0,
    hurt: start.hurt ?? 0,
    missing: start.missing ?? 0,
    needs: start.needs ?? [],
  };
}

type ReportStart = Pick<AssessmentFields, "ai_class" | "ai_hazards" | "verdict_class"> & {
  people: number;
  hurt: number;
  missing: number;
  needs: NeedValue[];
};

/**
 * A house with a family report starts from the family's counts and needs, the
 * hazards the hub saw in their photo, and the class from a staff verdict or
 * that reading. An unclear reading leaves the class for the responder to pick.
 */
export function startFromReport(report: ReportStart): { start: EntryStart; classFrom: ClassFrom } {
  const suggested = reportClass(report);
  const damage_class = suggested === null || suggested === "unclear" ? null : suggested;
  return {
    start: {
      damage_class,
      hazards: report.ai_hazards ?? [],
      people: report.people,
      hurt: report.hurt,
      missing: report.missing,
      needs: report.needs,
    },
    classFrom: damage_class === null ? null : report.verdict_class !== null ? "staff" : "photo",
  };
}

/** Confirm stays off until a class is chosen. */
export function canConfirm(form: Pick<EntryForm, "damage_class">): boolean {
  return form.damage_class !== null;
}

/** "Matches report" shows when the hurt count equals the family report. Nothing shows without a report. */
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
