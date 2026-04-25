import { test } from "@playwright/test";

/**
 * Visual snapshot pass — capture screenshots of every public route at
 * desktop and mobile viewports for manual review.
 *
 * Output: tests/e2e/.results/<browser>/<route>.png
 */

const ROUTES = [
  { path: "/", name: "homepage" },
  { path: "/berita", name: "berita-list" },
  { path: "/redaksi", name: "redaksi" },
  { path: "/tentang", name: "tentang" },
  { path: "/kontak", name: "kontak" },
  { path: "/login", name: "login" },
];

for (const route of ROUTES) {
  test(`screenshot ${route.name}`, async ({ page }, testInfo) => {
    // "load" not "networkidle" — pages with Turnstile / analytics keep
    // network busy and would never reach idle within the timeout.
    await page.goto(route.path, { waitUntil: "load" });
    // Allow lazy images / fonts to settle
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: testInfo.outputPath(`${route.name}.png`),
      fullPage: true,
    });
  });
}
