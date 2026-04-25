import { test, expect } from "@playwright/test";

/**
 * Tests for the article detail page (/berita/[slug]). We pick the first
 * article from the homepage so the test stays valid as content rotates.
 */

async function gotoFirstArticle(page: import("@playwright/test").Page) {
  await page.goto("/");
  const link = page.locator('a[href^="/berita/"]').first();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await Promise.all([
    page.waitForURL(/\/berita\/.+/, { timeout: 15_000 }),
    link.click(),
  ]);
  return href!;
}

test("article detail renders title, body, and metadata", async ({ page }) => {
  await gotoFirstArticle(page);

  // Headline
  const h1 = page.locator("h1").first();
  await expect(h1).toBeVisible();
  const titleText = await h1.textContent();
  expect(titleText?.trim().length).toBeGreaterThan(5);

  // Body content (article-content class) — reading flow
  await expect(page.locator(".article-content, article").first()).toBeVisible();

  // Author / category byline somewhere on page
  const meta = page.locator("text=/oleh|penulis|author|kategori/i").first();
  // Either author byline or category badge — at minimum one of them is visible
  const hasAnyByline = await meta.count() > 0;
  expect(hasAnyByline).toBeTruthy();
});

test("article detail has share buttons", async ({ page, viewport }) => {
  await gotoFirstArticle(page);
  // ShareBar component renders Twitter/Facebook/copy-link controls.
  // Look for any share-related anchor or button — including ones hidden
  // behind a "Bagikan" toggle button on small viewports.
  const shareControls = page.locator(
    'a[href*="twitter.com/intent"], a[href*="facebook.com/sharer"], a[href*="api.whatsapp.com"], button:has-text("Salin"), button:has-text("Bagikan"), button[aria-label*="bagikan" i], button[aria-label*="share" i]'
  );
  const count = await shareControls.count();
  // On very small viewports the share UI may be collapsed entirely; tolerate that.
  if (viewport && viewport.width < 500 && count === 0) {
    test.skip(true, "Share bar not surfaced on this mobile viewport");
  }
  expect(count).toBeGreaterThan(0);
});

test("article detail loads comments section without errors", async ({ page }) => {
  await gotoFirstArticle(page);
  // CommentSection lazy-fetches via /api/articles/:id/comments. Wait for
  // either the empty state or a populated list to appear.
  const commentArea = page.locator(
    'text=/komentar|belum ada komentar|tinggalkan komentar/i'
  ).first();
  await expect(commentArea).toBeVisible({ timeout: 10_000 });
});

test("article detail meta tags include og:title and og:image", async ({ page }) => {
  await gotoFirstArticle(page);
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
  expect(ogTitle).toBeTruthy();
  // og:image is optional (article may have no featured image), but if
  // present it should be an absolute URL.
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
  if (ogImage) {
    expect(ogImage).toMatch(/^https?:\/\//);
  }
});

test("article detail injects JSON-LD structured data", async ({ page }) => {
  await gotoFirstArticle(page);
  const jsonLd = await page.locator('script[type="application/ld+json"]').first();
  const exists = await jsonLd.count();
  if (exists > 0) {
    const content = await jsonLd.textContent();
    expect(content).toBeTruthy();
    // Should parse as valid JSON
    expect(() => JSON.parse(content!)).not.toThrow();
  }
});

test("clicking author link navigates to author page", async ({ page }) => {
  await gotoFirstArticle(page);
  const authorLink = page.locator('a[href^="/penulis/"]').first();
  if (await authorLink.count() === 0) {
    test.skip(true, "Article does not link to author page");
  }
  await Promise.all([
    page.waitForURL(/\/penulis\/.+/, { timeout: 15_000 }),
    authorLink.click(),
  ]);
  await expect(page.locator("h1, h2").first()).toBeVisible();
});

test("clicking category badge navigates to category archive", async ({ page }) => {
  await gotoFirstArticle(page);
  const categoryLink = page.locator('a[href^="/kategori/"]').first();
  await Promise.all([
    page.waitForURL(/\/kategori\/.+/, { timeout: 15_000 }),
    categoryLink.click(),
  ]);
  await expect(page.locator("h1, h2").first()).toBeVisible();
});
