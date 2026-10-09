// The id a phone makes once, when the family taps Send. The hub uses it to
// recognize a resend of the same report, so a lost reply never makes two.

/**
 * A v4 UUID. crypto.randomUUID only exists in secure contexts, and a phone can
 * reach the hub over plain HTTP on the LAN. getRandomValues works in both.
 */
export function newClientId(cryptoApi: Pick<Crypto, "getRandomValues"> & Partial<Pick<Crypto, "randomUUID">> = globalThis.crypto): string {
  if (typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
