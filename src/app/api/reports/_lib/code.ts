import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { reports } from "@/db/schema";
import { REPORT_CODE_ALPHABET } from "@/lib/contracts";
import type { Tx } from "./audit";

const CODE_LENGTH = 4;
const MAX_TRIES = 20;

/** Four characters from the safe alphabet, which has no I, O, 0 or 1. */
export function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += REPORT_CODE_ALPHABET[randomInt(REPORT_CODE_ALPHABET.length)];
  return code;
}

/**
 * A code no report uses yet. Call it inside the transaction that inserts the
 * report. The unique index on reports.code is the backstop.
 */
export function freshCode(tx: Tx | Db, make: () => string = randomCode): string {
  for (let i = 0; i < MAX_TRIES; i++) {
    const code = make();
    if (!tx.select({ id: reports.id }).from(reports).where(eq(reports.code, code)).get()) return code;
  }
  throw new Error("no_free_report_code");
}
