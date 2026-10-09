export const PIN_LENGTH = 6;

/** Add a digit, up to the PIN length. Anything that is not one digit is ignored. */
export function addDigit(pin: string, digit: string): string {
  if (!/^\d$/.test(digit) || pin.length >= PIN_LENGTH) return pin;
  return pin + digit;
}

export function removeDigit(pin: string): string {
  return pin.slice(0, -1);
}
