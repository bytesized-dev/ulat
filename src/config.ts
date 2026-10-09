// The values that change per product, in one place.

export const product = {
  name: "Ulat",
  oneLine: "Offline disaster damage reporting for LGUs.",
} as const;

export const locale = {
  lang: "en-PH",
  // Timestamps are stored in UTC and shown in Philippine time.
  defaultTimezone: "Asia/Manila",
} as const;

export const theme = {
  // The browser chrome colour cannot read a CSS variable, so these hex values
  // live here rather than in a component. They are --page in each scheme.
  light: "#f5f5f7",
  dark: "#0a0a0a",
} as const;
