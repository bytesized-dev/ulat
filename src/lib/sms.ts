/**
 * SMS summary for the situation report. Built by code from the snapshot, never by the model.
 * See docs/SPEC.md section 7.
 */

export type SmsSnapshot = {
  simulation: boolean;
  town: string;
  number: number;
  timeLabel: string; // for example "3PM"
  housesChecked: number;
  totally: number;
  partially: number;
  families: number;
  people: number;
  hurt: number;
  missing: number;
  priority: string[]; // barangay names, highest first
  needs: { water: number; food: number; tarp: number };
  notYetVisited: number;
};

export function buildSms(s: SmsSnapshot): string {
  const parts = [
    `${s.simulation ? "SIMULATION " : ""}${s.town.toUpperCase()} SITREP ${s.number}, ${s.timeLabel}:`,
    `${s.housesChecked} houses checked, ${s.totally} totally, ${s.partially} partially damaged.`,
    `${s.families} fam, ${s.people} persons affected.`,
    `${s.hurt} hurt, ${s.missing} missing.`,
    s.priority.length ? `Priority: ${s.priority.slice(0, 2).join(", ")}.` : "",
    `Needs: water ${s.needs.water} HH, food ${s.needs.food}, tarp ${s.needs.tarp}.`,
    `${s.notYetVisited} reports not yet visited.`,
    "MDRRMO",
  ];
  return parts.filter(Boolean).join(" ");
}

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
// These take two septets each in GSM-7.
const GSM7_EXTENSION = "^{}\\[~]|€\f";

/** Number of texts needed to send this message. */
export function smsSegments(text: string): number {
  let septets = 0;
  for (const ch of text) {
    if (GSM7_BASIC.includes(ch)) septets += 1;
    else if (GSM7_EXTENSION.includes(ch)) septets += 2;
    else {
      // Not GSM-7: the whole message goes as UCS-2, counted in UTF-16 units.
      const units = text.length;
      return units <= 70 ? 1 : Math.ceil(units / 67);
    }
  }
  return septets <= 160 ? 1 : Math.ceil(septets / 153);
}
