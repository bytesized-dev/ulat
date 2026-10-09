import { defineConfig } from "@playwright/test";

// Smoke tests for the demo loop. Points at a running app when E2E_BASE_URL is
// set, otherwise starts the production build on PORT, default 3000.

const port = process.env.PORT ?? "3000";
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `pnpm start --port ${port}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 60_000 },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
