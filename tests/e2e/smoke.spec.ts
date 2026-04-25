import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke tests for Kartawarta — verify all public routes render without
 * 5xx, expected key elements are present, and no console errors fire.
 *
 * Default target is production (https://kartawarta.com). Override via:
 *   BASE_URL=http://localhost:3000 npx playwright test
 *
 * These tests do NOT submit forms (no comments/votes/contact) to avoid
 * polluting production data.
 */

const PUBLIC_ROUTES = [
  { path: "/", title: /Kartawarta/i, h1OrH2: true },
  { path: "/berita", title: /Berita/i, h1OrH2: true },
  { path: "/redaksi", title: /Redaksi/i, h1OrH2: true },
  { path: "/tentang", title: /Tentang/i, h1OrH2: true },
  { path: "/kode-etik", title: /Kode Etik/i, h1OrH2: true },
  { path: "/pedoman-media", title: /Pedoman/i, h1OrH2: true },
  { path: "/syarat-ketentuan", title: /Syarat/i, h1OrH2: true },
  { path: "/privasi", title: /Privasi/i, h1OrH2: true },
  { path: "/kontak", title: /Hubungi|Kontak/i, h1OrH2: true },
  { path: "/login", title: /Kartawarta/i, h1OrH2: false },
  { path: "/search?q=hukum", title: /Kartawarta/i, h1OrH2: false },
];

/**
 * Pageerror filters — drop messages that are known production noise we
 * intentionally want smoke tests to ignore. Anything not matched here is
 * still asserted as a real failure.
 *
 * Hydration errors (#418/423/425) intentionally NOT filtered — root cause
 * fixed via <ClientDate> deferral pattern. Regressions should fail tests
 * immediately.
 */
const NOISE_PATTERNS = [
  "favicon",
  "Failed to load resource",
  "net::ERR_BLOCKED_BY_CLIENT",
  "ResizeObserver",
];

function isNoise(text: string): boolean {
  return NOISE_PATTERNS.some((p) => text.includes(p));
}

function attachConsoleListeners(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    if (!isNoise(err.message)) errors.push(`pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!isNoise(text)) errors.push(`console.error: ${text}`);
    }
  });
  return errors;
}

for (const route of PUBLIC_ROUTES) {
  test(`GET ${route.path} renders without 5xx`, async ({ page }) => {
    const errors = attachConsoleListeners(page);

    const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(response, `no response for ${route.path}`).not.toBeNull();
    const status = response!.status();
    expect(status, `${route.path} returned ${status}`).toBeLessThan(500);

    await expect(page).toHaveTitle(route.title, { timeout: 10_000 });

    if (route.h1OrH2) {
      const heading = page.locator("h1, h2").first();
      await expect(heading).toBeVisible();
    }

    expect(errors, `console errors on ${route.path}: ${errors.join(" | ")}`).toEqual([]);
  });
}

test("homepage shows article cards and category navigation", async ({ page }) => {
  await page.goto("/");

  // Categories nav (one or more visible)
  const categoryLink = page.locator('a[href^="/kategori/"]').first();
  await expect(categoryLink).toBeVisible();

  // At least one article card link
  const articleLink = page.locator('a[href^="/berita/"]').first();
  await expect(articleLink).toBeVisible();
});

test("clicking a homepage article navigates to detail page", async ({ page }) => {
  await page.goto("/");
  const firstArticleLink = page.locator('a[href^="/berita/"]').first();
  const href = await firstArticleLink.getAttribute("href");
  expect(href).toBeTruthy();

  await Promise.all([
    page.waitForURL(/\/berita\/.+/, { timeout: 15_000 }),
    firstArticleLink.click(),
  ]);

  // Article detail must have h1 + body content
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("article, .article-content, main").first()).toBeVisible();
});

test("category page lists articles under that category", async ({ page }) => {
  await page.goto("/");
  const categoryLink = page.locator('a[href^="/kategori/"]').first();
  await Promise.all([
    page.waitForURL(/\/kategori\/.+/, { timeout: 15_000 }),
    categoryLink.click(),
  ]);
  await expect(page.locator("h1, h2").first()).toBeVisible();
});

test("login page has email + password fields", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
});

test("/panel redirect to /login when not authenticated", async ({ page }) => {
  const response = await page.goto("/panel/dashboard", { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  // Should land on /login (with callbackUrl)
  expect(page.url()).toMatch(/\/login/);
});

test("RSS feed responds with XML", async ({ request }) => {
  const res = await request.get("/feed.xml");
  expect(res.status()).toBeLessThan(500);
  if (res.ok()) {
    const text = await res.text();
    expect(text).toMatch(/<rss|<feed/);
  }
});

test("news sitemap responds with XML", async ({ request }) => {
  const res = await request.get("/news-sitemap.xml");
  expect(res.status()).toBeLessThan(500);
});

test("robots.txt is reachable", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.ok()).toBeTruthy();
  const text = await res.text();
  expect(text.toLowerCase()).toContain("user-agent");
});
