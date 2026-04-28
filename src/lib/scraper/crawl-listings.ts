/**
 * Multi-page listing crawler.
 *
 * Used when a NewsSource has `crawlSubcategories=true`. Starts at the
 * root listing URL, extracts article candidates, then follows
 * "sub-listing" links — sibling/child paths under the root listing's
 * path that look like category pages, not article pages — and pulls
 * candidates from those too.
 *
 * Bounded:
 *   - `crawlMaxPages` overall cap (root + subs).
 *   - Same host as the root URL only.
 *   - Sub-listing path must start with the root's parent path prefix.
 *   - Skips obvious article-shaped URLs (long slugs, year/month in
 *     path, "read", "article-details", etc.).
 *
 * Returns aggregated candidates deduped by URL plus the list of pages
 * actually visited so the panel can surface what was crawled.
 */

import * as cheerio from "cheerio";
import { fetchListing } from "./fetch-listing";
import { fetchHtml } from "./fetch";
import { fetchHtmlHeadless } from "./headless";
import type { ListingItem, ScraperOptions } from "./types";

interface CrawlOptions extends ScraperOptions {
  crawlMaxPages?: number;
}

interface CrawlResult {
  items: ListingItem[];
  pagesVisited: string[];
  /** First selector that matched on the root page. */
  selectorUsed: string;
}

/**
 * Patterns that suggest a URL points to an article rather than a
 * sub-listing. We skip these when collecting sub-listing candidates.
 */
const ARTICLE_PATH_HINTS = [
  /\/read\//i,
  /\/article-details\//i,
  /\/article\//i,
  /\/post\//i,
  /\/news\/[^/]+\/[^/]{20,}/i, // /news/<cat>/<long-slug>
  /\/(19|20)\d{2}\/\d{1,2}\//, // year/month in path → typical article
  /\/p\/\d+/, // /p/123 style permalinks
];

function looksLikeArticle(pathname: string): boolean {
  return ARTICLE_PATH_HINTS.some((re) => re.test(pathname));
}

/** Extract anchors that look like sub-listing pages. */
function findSubListings(
  html: string,
  currentPageUrl: string,
  rootListingUrl: string,
): string[] {
  let root: URL;
  let current: URL;
  try {
    root = new URL(rootListingUrl);
    current = new URL(currentPageUrl);
  } catch {
    return [];
  }
  if (current.host !== root.host) return [];

  const rootPath = root.pathname.replace(/\/$/, "");
  const rootSegments = rootPath.split("/").filter(Boolean);
  // We accept links whose path starts with root's parent. So
  // "/page/berita" → parent "/page" → accept "/page/berita/keuangan".
  // For "/" or single-segment listing roots, fall back to host-wide
  // collection but keep depth in check.
  const rootParent =
    rootSegments.length > 0
      ? "/" + rootSegments.slice(0, -1).join("/")
      : "/";

  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    let abs: URL;
    try {
      abs = new URL(href, currentPageUrl);
    } catch {
      return;
    }
    if (abs.host !== root.host) return;
    if (!/^https?:$/.test(abs.protocol)) return;
    const linkPath = abs.pathname.replace(/\/$/, "");
    if (linkPath === rootPath) return; // root itself
    if (linkPath === currentPageUrl.replace(/\/$/, "")) return;
    if (looksLikeArticle(linkPath)) return;

    // Path must share at least the parent path with the root.
    if (!(linkPath === rootParent || linkPath.startsWith(rootParent + "/"))) {
      return;
    }
    // Cap depth at parent-depth + 2.
    const depth = linkPath.split("/").filter(Boolean).length;
    const maxDepth = rootSegments.length + 2;
    if (depth > maxDepth) return;

    // Strip query/hash for dedup
    abs.search = "";
    abs.hash = "";
    out.add(abs.toString());
  });
  return Array.from(out);
}

async function getRawHtml(
  url: string,
  options: ScraperOptions,
): Promise<{ html: string; finalUrl: string }> {
  if (options.useHeadless) {
    return fetchHtmlHeadless(url, {
      timeoutMs: options.timeoutMs,
      waitForSelector: options.waitForSelector ?? options.articleSelector ?? null,
      userAgent: options.userAgent,
    });
  }
  return fetchHtml(url, {
    userAgent: options.userAgent,
    timeoutMs: options.timeoutMs,
  });
}

export async function crawlListings(
  rootUrl: string,
  options: CrawlOptions = {},
): Promise<CrawlResult> {
  const maxPages = Math.max(1, Math.min(options.crawlMaxPages ?? 8, 20));
  const visited = new Set<string>([rootUrl]);
  const queue: string[] = [];
  const allItems: ListingItem[] = [];
  const pagesVisited: string[] = [];

  // 1. Fetch root via existing fetchListing (uses card detection logic).
  const rootResult = await fetchListing(rootUrl, options);
  pagesVisited.push(rootUrl);
  allItems.push(...rootResult.items);

  // 2. Collect candidate sub-listing URLs from the root page.
  const { html: rootHtml } = await getRawHtml(rootUrl, options);
  for (const sub of findSubListings(rootHtml, rootUrl, rootUrl)) {
    if (!visited.has(sub) && visited.size < maxPages) {
      visited.add(sub);
      queue.push(sub);
    }
  }

  // 3. BFS through sub-listings — extract candidates from each.
  while (queue.length > 0 && pagesVisited.length < maxPages) {
    const url = queue.shift()!;
    try {
      const r = await fetchListing(url, options);
      pagesVisited.push(url);
      allItems.push(...r.items);
    } catch {
      // Sub-listing page may not have detectable cards (e.g. it's a
      // landing/marketing page rather than a listing). Skip silently.
      pagesVisited.push(url);
    }
  }

  // 4. Dedup by article URL.
  const seen = new Set<string>();
  const deduped: ListingItem[] = [];
  for (const item of allItems) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    deduped.push(item);
  }

  return {
    items: deduped,
    pagesVisited,
    selectorUsed: rootResult.selectorUsed,
  };
}
