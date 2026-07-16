import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Lensaplus production smoke tests.
 *
 * Usage:
 *   npx playwright test                    — run all e2e
 *   npx playwright test --headed           — watch in real browser
 *   npx playwright test --ui               — interactive UI mode
 *   npx playwright show-report             — open last HTML report
 *
 * BASE_URL env override (default https://lensaplus.com):
 *   $env:BASE_URL='http://localhost:3000'; npx playwright test
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "tests/e2e/.report" }],
  ],
  use: {
    baseURL: process.env.BASE_URL || "https://lensaplus.com",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
