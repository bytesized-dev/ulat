import { describe, expect, it } from "vitest";
import { addDigit, PIN_LENGTH, removeDigit } from "./pin-entry";

describe("pin entry", () => {
  it("adds digits up to the PIN length", () => {
    let pin = "";
    for (const d of "12345678") pin = addDigit(pin, d);
    expect(pin).toBe("123456");
    expect(pin).toHaveLength(PIN_LENGTH);
  });

  it("ignores anything that is not one digit", () => {
    expect(addDigit("12", "a")).toBe("12");
    expect(addDigit("12", "34")).toBe("12");
    expect(addDigit("12", "")).toBe("12");
  });

  it("deletes the last digit and is safe on an empty PIN", () => {
    expect(removeDigit("123")).toBe("12");
    expect(removeDigit("")).toBe("");
  });
});
