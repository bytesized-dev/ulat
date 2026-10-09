import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Only src/lib/time imports date-fns. Every other file uses its helpers, so
// timezone handling stays in one place. Timestamps are stored in UTC and
// shown in Philippine time.

const rawDateMessage = "Only src/lib/time imports date-fns. Add a helper there and use it.";

const restrictRawDates = {
  paths: [
    { name: "date-fns", message: rawDateMessage },
    { name: "@date-fns/tz", message: rawDateMessage },
  ],
  // "date-fns/format" is the same library through a side door.
  patterns: [{ group: ["date-fns/*", "@date-fns/*"], message: rawDateMessage }],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "data/**", "playwright-report/**", "test-results/**", ".claude/**"]),
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/time/**"],
    rules: { "no-restricted-imports": ["error", restrictRawDates] },
  },
]);

export default eslintConfig;
