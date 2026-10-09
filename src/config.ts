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

export const map = {
  // PLACEHOLDER. A box about 4 km across near Cebu City, used when the hub has
  // no map_bbox yet. Replace it with the real town. Seed positions are
  // percentages of this box, so every pin moves with it.
  placeholderBbox: { west: 123.867, south: 10.2977, east: 123.904, north: 10.3337 },
} as const;
