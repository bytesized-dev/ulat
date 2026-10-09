import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts", "tests/unit/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
