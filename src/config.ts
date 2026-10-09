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
  // The browser chrome colour cannot read a CSS variable, so this hex value
  // lives here rather than in a component. It is canvas, the page background.
  light: "#ffffff",
} as const;
