import { createCn } from "cn/config";

// The type scale lives in globals.css as --text-label through --text-title, so
// Tailwind generates text-body, text-label and the rest as font sizes. The
// class merger cannot tell those from a text colour like text-on-action,
// because both are "text-" followed by a word, so it treated them as one group
// and dropped whichever came first.
//
// That is not theoretical. It shipped: the primary pill sets text-on-action in
// its variant and text-body in its size, the size wins by order, and the
// button rendered black on black with the label invisible. The danger pill
// lost its red the same way and nobody noticed, because black text on a grey
// pill looks deliberate.
//
// Naming the scale here is the fix. Add a size to globals.css and add it here
// in the same change, or the next colour to share a component with it goes
// quiet. tests/unit/class-merge.test.ts fails when they drift apart.
export const typeScale = ["label", "small", "body", "heading", "title"] as const;

export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: [...typeScale] }],
    },
  },
});
