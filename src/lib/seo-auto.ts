/**
 * SEO Automation Utilities
 * - Ping Google & Bing when articles are published (IndexNow + Indexing API)
 * - Auto-generate seoTitle & seoDescription from content
 * - Sitemap ping to search engines
 * - Trigger Sorotan generator (non-blocking)
 * - Placeholder for Cloudflare cache purge (implemented in Phase 6)
 */

import { prisma } from "@/lib/prisma";
import { submitUrlToGoogle } from "./seo/google-indexing";
import { pingIndexNow } from "./seo/indexnow";
import { generateSorotanIfMissing } from "./seo/sorotan-generator";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

// ─── Ping Search Engines ───────────────────────────────────────────

/** Ping Google & Bing sitemap update (legacy sitemap ping — kept for backward compat). */
export async function pingSitemaps() {
  const sitemapUrl = encodeURIComponent(`${SITE_URL}/sitemap.xml`);
  const newsSitemapUrl = encodeURIComponent(`${SITE_URL}/sitemap-news.xml`);

  const urls = [
    `https://www.google.com/ping?sitemap=${sitemapUrl}`,
    `https://www.google.com/ping?sitemap=${newsSitemapUrl}`,
    `https://www.bing.com/ping?sitemap=${sitemapUrl}`,
  ];

  await Promise.allSettled(
    urls.map((url) =>
      fetch(url, { method: "GET", signal: AbortSignal.timeout(5000) }).catch(() => {})
    )
  );
}

// ─── Auto-Generate SEO Fields ──────────────────────────────────────

/** Generate seoTitle from article title (max 60 chars, append brand) */
export function generateSeoTitle(title: string): string {
  const clean = title.trim();
  if (clean.length <= 50) return `${clean} | Kartawarta`;
  // Truncate at word boundary
  const truncated = clean.substring(0, 57).replace(/\s+\S*$/, "");
  return `${truncated}...`;
}

/** Generate seoDescription from excerpt or content (max 155 chars) */
export function generateSeoDescription(excerpt: string | null, content: string): string {
  // Prefer excerpt
  if (excerpt && excerpt.trim().length > 20) {
    const clean = excerpt.trim();
    if (clean.length <= 155) return clean;
    return clean.substring(0, 152).replace(/\s+\S*$/, "") + "...";
  }
  // Fallback: strip HTML from content
  const text = content
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= 155) return text;
  return text.substring(0, 152).replace(/\s+\S*$/, "") + "...";
}

// ─── Canonical Slug Check ──────────────────────────────────────────

/** Ensure slug doesn't have issues */
export function validateSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 100;
}

// ─── All-in-one: call after publish ────────────────────────────────

interface PublishChainSummary {
  url: string;
  googleIndexing: { ok: boolean; error?: string };
  indexNow: { ok: boolean; error?: string };
  sorotan: { ok: boolean; error?: string };
}

/**
 * Invoked after an article transitions to PUBLISHED.
 *
 * Fan-out (non-blocking, Promise.allSettled):
 *   1. Google Indexing API submit
 *   2. IndexNow ping (Bing/Yandex/...)
 *   3. Sorotan generator (if missing)
 *   4. Cloudflare cache purge — Phase 6 (placeholder)
 *
 * The function is fire-and-forget from the caller's perspective: it never
 * throws, and updates `Article.indexStatus` / `lastIndexedAt` when Google
 * accepts the URL.
 *
 * `articleId` is optional for backward compatibility with existing callers
 * that only have the slug. When omitted, the Sorotan step and the status
 * update are looked up by slug.
 */
export async function onArticlePublished(
  slug: string,
  articleId?: string,
): Promise<void> {
  const url = `${SITE_URL}/berita/${slug}`;

  // Resolve articleId if caller didn't pass it — needed for Sorotan + status
  let resolvedId = articleId;
  let categorySlug: string | null = null;
  if (!resolvedId) {
    try {
      const article = await prisma.article.findUnique({
        where: { slug },
        select: { id: true, category: { select: { slug: true } } },
      });
      resolvedId = article?.id;
      categorySlug = article?.category.slug ?? null;
    } catch {
      // DB unreachable — continue with indexing-only path
    }
  } else {
    try {
      const article = await prisma.article.findUnique({
        where: { id: resolvedId },
        select: { category: { select: { slug: true } } },
      });
      categorySlug = article?.category.slug ?? null;
    } catch {
      // ignore
    }
  }

  // URLs to notify — article page, homepage, news sitemap, category page.
  const indexNowUrls = [
    url,
    `${SITE_URL}/`,
    `${SITE_URL}/sitemap-news.xml`,
    ...(categorySlug ? [`${SITE_URL}/kategori/${categorySlug}`] : []),
  ];

  // Placeholder for Cloudflare cache purge (Phase 6 — `cloudflare-ops`).
  // TODO(phase-6): import purgeCloudflareCache from '@/lib/cloudflare/purge'
  //                and add to Promise.allSettled below.
  const [googleRes, indexNowRes, sorotanRes] = await Promise.allSettled([
    submitUrlToGoogle(url, "URL_UPDATED"),
    pingIndexNow(indexNowUrls),
    resolvedId ? generateSorotanIfMissing(resolvedId) : Promise.resolve(),
  ]);

  const summary: PublishChainSummary = {
    url,
    googleIndexing:
      googleRes.status === "fulfilled"
        ? { ok: googleRes.value.success, error: googleRes.value.error }
        : { ok: false, error: String(googleRes.reason) },
    indexNow:
      indexNowRes.status === "fulfilled"
        ? { ok: indexNowRes.value.success, error: indexNowRes.value.error }
        : { ok: false, error: String(indexNowRes.reason) },
    sorotan:
      sorotanRes.status === "fulfilled"
        ? { ok: true }
        : { ok: false, error: String(sorotanRes.reason) },
  };

  // Update Article.indexStatus based on Google Indexing result.
  if (resolvedId) {
    try {
      await prisma.article.update({
        where: { id: resolvedId },
        data: {
          indexStatus: summary.googleIndexing.ok ? "submitted" : "failed",
          lastIndexedAt: new Date(),
        },
      });
    } catch {
      // swallow
    }

    // Audit log entry — non-blocking.
    try {
      await prisma.auditLog.create({
        data: {
          userId: "system",
          action: "ARTICLE_PUBLISHED_SEO_CHAIN",
          entity: "article",
          entityId: resolvedId,
          detail: JSON.stringify(summary),
        },
      });
    } catch {
      // swallow — AuditLog requires a valid user FK; 'system' may not exist.
    }
  }
}
