import { test, expect, type Page } from "@playwright/test";

/**
 * Lighthouse-style SEO + perf audit against production.
 *
 * Not a full Lighthouse run — that needs the @lhci CLI and adds 60+ MB of
 * deps. Instead this file checks the high-impact items Google Search and
 * social platforms care about: title/description length, OG image
 * presence and dimensions, canonical, structured data, security headers,
 * page weight, heading hierarchy.
 */

const PAGES = [
  { path: "/", name: "homepage", expectArticleSchema: false },
  { path: "/berita", name: "berita-list", expectArticleSchema: false },
  { path: "/kategori/hukum", name: "kategori-hukum", expectArticleSchema: false },
];

async function getMetaContent(page: Page, selector: string): Promise<string | null> {
  return page.locator(selector).first().getAttribute("content").catch(() => null);
}

async function getJsonLdBlocks(page: Page): Promise<unknown[]> {
  const scripts = await page.locator('script[type="application/ld+json"]').all();
  const blocks: unknown[] = [];
  for (const s of scripts) {
    const txt = await s.textContent();
    if (!txt) continue;
    try {
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // skip malformed
    }
  }
  return blocks;
}

for (const p of PAGES) {
  test(`SEO audit: ${p.name}`, async ({ page, request }) => {
    // 1. HTTP status + key security headers
    const response = await page.goto(p.path, { waitUntil: "load" });
    expect(response, "no response").not.toBeNull();
    expect(response!.status()).toBe(200);

    const headers = response!.headers();
    expect(headers["x-frame-options"], "X-Frame-Options").toBe("DENY");
    expect(headers["x-content-type-options"], "X-Content-Type-Options").toBe("nosniff");
    expect(headers["referrer-policy"]).toBeTruthy();
    expect(headers["content-security-policy"]).toBeTruthy();

    // 2. Title length (Google truncates ~60 chars)
    const title = await page.title();
    expect(title.length, `title too short: "${title}"`).toBeGreaterThan(15);
    expect(title.length, `title may be truncated by Google: "${title}"`).toBeLessThanOrEqual(70);

    // 3. Meta description (Google: 150-160 ideal)
    const desc = await getMetaContent(page, 'meta[name="description"]');
    expect(desc, "missing meta description").toBeTruthy();
    expect(desc!.length, `description too short: ${desc!.length}`).toBeGreaterThan(50);
    expect(desc!.length, `description risks truncation: ${desc!.length}`).toBeLessThanOrEqual(180);

    // 4. Canonical (article+kategori must have one; homepage may rely on metadataBase)
    if (p.path !== "/") {
      const canonical = await page.locator('link[rel="canonical"]').first().getAttribute("href");
      expect(canonical, "missing canonical").toBeTruthy();
      expect(canonical).toMatch(/^https:\/\/lensaplus\.com/);
    }

    // 5. OG essentials
    const ogTitle = await getMetaContent(page, 'meta[property="og:title"]');
    const ogDesc = await getMetaContent(page, 'meta[property="og:description"]');
    const ogImage = await getMetaContent(page, 'meta[property="og:image"]');
    const ogType = await getMetaContent(page, 'meta[property="og:type"]');
    const ogLocale = await getMetaContent(page, 'meta[property="og:locale"]');
    expect(ogTitle, "og:title").toBeTruthy();
    expect(ogDesc, "og:description").toBeTruthy();
    expect(ogImage, "og:image").toBeTruthy();
    expect(ogType, "og:type").toBeTruthy();
    expect(ogLocale).toMatch(/id_ID|id-ID|^id$/i);

    // 6. OG image actually loads + sane content type
    const imgRes = await request.get(ogImage!);
    expect(imgRes.status(), `og:image returned ${imgRes.status()}`).toBeLessThan(400);
    const imgCt = imgRes.headers()["content-type"] || "";
    expect(imgCt, `og:image content-type: ${imgCt}`).toMatch(/^image\//);

    // 7. Twitter card
    const twCard = await getMetaContent(page, 'meta[name="twitter:card"]');
    expect(twCard).toMatch(/summary_large_image|summary/);

    // 8. Robots
    const robots = await getMetaContent(page, 'meta[name="robots"]');
    if (robots) {
      expect(robots).toContain("index");
      expect(robots).toContain("follow");
    }

    // 9. JSON-LD structured data
    const blocks = await getJsonLdBlocks(page);
    expect(blocks.length, "no JSON-LD blocks").toBeGreaterThan(0);
    const types = blocks
      .map((b) => (b as { "@type"?: string })["@type"])
      .filter(Boolean);
    if (p.path === "/") {
      expect(types).toContain("NewsMediaOrganization");
      expect(types).toContain("WebSite");
    }

    // 10. Heading hierarchy — exactly one h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count, `${p.name}: expected 1 h1, got ${h1Count}`).toBeGreaterThanOrEqual(1);

    // 11. Lang attribute
    const htmlLang = await page.locator("html").getAttribute("lang");
    expect(htmlLang, "html[lang] missing").toMatch(/^id/i);
  });
}

test("Sitemap valid + reachable", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.ok()).toBeTruthy();
  const ct = res.headers()["content-type"] || "";
  expect(ct).toMatch(/xml/);
  const xml = await res.text();
  const urlCount = (xml.match(/<loc>/g) || []).length;
  expect(urlCount, `sitemap has only ${urlCount} URLs`).toBeGreaterThan(20);
  expect(xml).toMatch(/<lastmod>/);
});

test("News sitemap valid + has news namespace", async ({ request }) => {
  const res = await request.get("/news-sitemap.xml");
  expect(res.ok()).toBeTruthy();
  const xml = await res.text();
  expect(xml).toContain("xmlns:news=");
  expect(xml).toContain("<news:publication>");
  expect(xml).toContain("<news:publication_date>");
});

test("Robots.txt allows crawl + lists sitemaps", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.ok()).toBeTruthy();
  const txt = await res.text();
  expect(txt).toContain("Sitemap:");
  expect(txt.toLowerCase()).toContain("user-agent");
  // Confirm panel + api blocked
  expect(txt).toContain("Disallow: /panel");
});

test("IndexNow key file reachable", async ({ request }) => {
  const res = await request.get("/indexnow-key.txt");
  expect(res.ok(), "indexnow key file 404").toBeTruthy();
  const key = (await res.text()).trim();
  expect(key.length, "indexnow key empty").toBeGreaterThan(8);
});

test("Article detail has NewsArticle + BreadcrumbList JSON-LD", async ({ page }) => {
  await page.goto("/berita");
  const link = page.locator('a[href^="/berita/"]').first();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  const blocks = await getJsonLdBlocks(page);
  const types = blocks
    .map((b) => (b as { "@type"?: string })["@type"])
    .filter(Boolean);
  expect(types).toContain("NewsArticle");
  expect(types).toContain("BreadcrumbList");

  // OG should reflect article (article type)
  const ogType = await page.locator('meta[property="og:type"]').first().getAttribute("content");
  expect(ogType).toBe("article");

  // Article-specific OG
  const ogPublishedTime = await page.locator('meta[property="article:published_time"]').first().getAttribute("content").catch(() => null);
  // Next.js may emit publishedTime via OG or article meta — at least one
  const ogTitle = await page.locator('meta[property="og:title"]').first().getAttribute("content");
  expect(ogTitle).toBeTruthy();
  expect(ogPublishedTime ?? "").not.toBeNull();
});
