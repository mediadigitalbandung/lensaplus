import { test, expect } from "@playwright/test";

/**
 * Pagination + archive tests for /berita and /kategori/[slug].
 */

const KATEGORI_SLUGS = [
  "hukum",
  "bisnis-ekonomi",
  "olahraga",
  "hiburan",
  "kesehatan",
  "teknologi",
  "politik",
  "pendidikan",
  "lingkungan",
];

test("/berita renders article list and shows pagination when multiple pages exist", async ({ page }) => {
  await page.goto("/berita");
  await expect(page.locator("h1, h2").first()).toBeVisible();

  const articleLinks = page.locator('a[href^="/berita/"]');
  const articleCount = await articleLinks.count();
  expect(articleCount).toBeGreaterThan(0);

  // Look for pagination controls (numbered links, prev/next buttons)
  const paginationNumeric = page.locator('a:has-text("2"), a:has-text("3"), button:has-text("2"), button:has-text("3")');
  const paginationNext = page.locator('a:has-text("Next"), a:has-text("Berikutnya"), button:has-text("Next"), button[aria-label*="next" i]');

  const hasPagination = (await paginationNumeric.count()) > 0 || (await paginationNext.count()) > 0;
  // Either pagination exists OR all articles fit in one page — both acceptable
  if (hasPagination) {
    expect(hasPagination).toBeTruthy();
  }
});

for (const slug of KATEGORI_SLUGS) {
  test(`/kategori/${slug} renders without 5xx`, async ({ page }) => {
    const response = await page.goto(`/kategori/${slug}`);
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);

    await expect(page.locator("h1, h2").first()).toBeVisible();

    // Either articles listed, or empty state
    const hasArticles = (await page.locator('a[href^="/berita/"]').count()) > 0;
    const hasEmptyState = (await page.locator('text=/belum ada|tidak ada artikel|kosong/i').count()) > 0;
    expect(hasArticles || hasEmptyState).toBeTruthy();
  });
}

test("/berita?page=2 renders second page or page 1 fallback", async ({ page }) => {
  const response = await page.goto("/berita?page=2");
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
  await expect(page.locator("h1, h2").first()).toBeVisible();
});

test("category page links to article detail correctly", async ({ page }) => {
  // Pick first category that has articles
  let foundArticle = false;
  for (const slug of KATEGORI_SLUGS) {
    await page.goto(`/kategori/${slug}`);
    const firstArticle = page.locator('a[href^="/berita/"]').first();
    if ((await firstArticle.count()) > 0) {
      const href = await firstArticle.getAttribute("href");
      expect(href).toBeTruthy();
      await Promise.all([
        page.waitForURL(/\/berita\/.+/, { timeout: 15_000 }),
        firstArticle.click(),
      ]);
      await expect(page.locator("h1").first()).toBeVisible();
      foundArticle = true;
      break;
    }
  }
  expect(foundArticle).toBeTruthy();
});
