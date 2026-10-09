import { defineConfig } from "@playwright/test";

// Smoke test for the demo loop. It starts its own dev server on a throwaway
// database that is pushed and seeded fresh, with MOCK_AI=1 so no Ollama is
// needed. Set E2E_BASE_URL to point at an app that is already running instead.

const port = process.env.KERNEL_PORT ?? process.env.PORT ?? "3000";
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
const database = "data/e2e.db";
// Photos and audio from the test land here, not in the shared data/uploads.
const uploads = "data/e2e-uploads";

export default defineConfig({
  testDir: "tests/e2e",
  // The whole loop has to finish in under 2 minutes, server start included.
  globalTimeout: 120_000,
  timeout: 100_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  // A screen that is not built yet should fail in seconds, not at the test timeout.
  use: { baseURL, actionTimeout: 10_000, navigationTimeout: 20_000, trace: "retain-on-failure" },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `rm -rf ${uploads} && rm -f ${database} ${database}-shm ${database}-wal && pnpm db:push && pnpm db:seed && pnpm dev --port ${port}`,
        env: { DATABASE_PATH: database, UPLOAD_DIR: uploads, MOCK_AI: "1" },
        url: baseURL,
        // A server that is already up has an unknown database, so never reuse it.
        reuseExistingServer: false,
        timeout: 60_000,
      },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        // The responder records a note, so give Chromium a microphone that plays a tone.
        launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
      },
    },
  ],
});
