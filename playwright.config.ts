// End-to-end suite. Run it through `npm run e2e` (scripts/e2e.mjs), which provides the throwaway database; running
// `npx playwright test` directly would start the app against whatever DATABASE_URL is in the shell.
import { defineConfig, devices } from "@playwright/test";
import type { Fixtures } from "./e2e/fixtures";

const PORT = 3200;

export default defineConfig<Fixtures>({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The installed Chrome: no browser download.
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "ar-desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", loc: "ar" } },
    { name: "en-desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", loc: "en" } },
    { name: "ar-phone", use: { ...devices["Pixel 7"], channel: "chrome", loc: "ar" } },
    { name: "en-phone", use: { ...devices["Pixel 7"], channel: "chrome", loc: "en" } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
