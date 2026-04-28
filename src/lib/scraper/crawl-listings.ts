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
  /** Number of paginated listing pages to follow (1 = root only). */
  paginationMaxPages?: number;
  /** Pagination URL template, e.g. "?page={n}" or "/page/{n}". */
  paginationPattern?: string | null;
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

/**
 * Build the list of paginated listing URLs derived from `rootUrl`.
 *
 * Algorithm:
 *   1. If `pattern` is supplied, substitute `{n}` for each page number.
 *   2. Else auto-detect: if the root URL already has `?page=N`, `?p=N`,
 *      or `/page/N`, reuse that pattern.
 *   3. Else default to "?page={n}" — the most common convention.
 *
 * Always emits page numbers 1..maxPages; root URL stays as-is for page 1
 * unless it would conflict with the detected pattern, in which case the
 * pattern wins.
 */
function expandPagination(
  rootUrl: string,
  maxPages: number,
  pattern: string | null | undefined,
): string[] {
  if (maxPages <= 1) return [rootUrl];

  // Detect/normalise pattern.
  let template = (pattern || "").trim();
  let baseUrl = rootUrl;

  if (!template) {
    // Auto-detect from root URL.
    try {
      const u = new URL(rootUrl);
      if (u.searchParams.has("page")) {
        template = "?page={n}";
        u.searchParams.delete("page");
        baseUrl = u.toString().replace(/\?$/, "");
      } else if (u.searchParams.has("p")) {
        template = "?p={n}";
        u.searchParams.delete("p");
        baseUrl = u.toString().replace(/\?$/, "");
      } else if (/\/page\/\d+\/?$/.test(u.pathname)) {
        template = "/page/{n}";
        u.pathname = u.pathname.replace(/\/page\/\d+\/?$/, "");
        baseUrl = u.toString();
      } else {
        template = "?page={n}";
      }
    } catch {
      template = "?page={n}";
    }
  } else if (rootUrl.includes("?page=") || rootUrl.includes("?p=")) {
    // Strip existing pagination from rootUrl to avoid duplication.
    try {
      const u = new URL(rootUrl);
      u.searchParams.delete("page");
      u.searchParams.delete("p");
      baseUrl = u.toString().replace(/\?$/, "");
    } catch {
      /* keep baseUrl as-is */
    }
  }

  const urls: string[] = [];
  for (let n = 1; n <= maxPages; n++) {
    const suffix = template.replace(/\{n\}/g, String(n));
    // If template starts with `?` we glue with `?` or `&` depending on baseUrl.
    if (suffix.startsWith("?")) {
      const glue = baseUrl.includes("?") ? "&" + suffix.slice(1) : suffix;
      urls.push(baseUrl + glue);
    } else {
      // Path-style: glue without doubling slashes.
      const trimmed = baseUrl.replace(/\/$/, "");
      const path = suffix.startsWith("/") ? suffix : "/" + suffix;
      urls.push(trimmed + path);
    }
  }
  return urls;
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
  const maxPages = Math.max(1, Math.min(options.crawlMaxPages ?? 8, 50));
  const paginationMax = Math.max(1, Math.min(options.paginationMaxPages ?? 1, 30));
  const visited = new Set<string>();
  const queue: string[] = [];
  const allItems: ListingItem[] = [];
  const pagesVisited: string[] = [];
  let firstSelectorUsed = "";

  // 1. Build the paginated listing URL set (e.g. ?page=1, ?page=2, …).
  //    If paginationMax = 1 this is just [rootUrl].
  const paginatedRoots = expandPagination(
    rootUrl,
    paginationMax,
    options.paginationPattern,
  );

  // 2. Fetch each paginated root, aggregate cards. First page also feeds
  //    sub-listing discovery.
  for (const pageUrl of paginatedRoots) {
    if (visited.has(pageUrl)) continue;
    visited.add(pageUrl);
    if (pagesVisited.length >= maxPages) break;
    try {
      const r = await fetchListing(pageUrl, options);
      pagesVisited.push(pageUrl);
      allItems.push(...r.items);
      if (!firstSelectorUsed) firstSelectorUsed = r.selectorUsed;
    } catch {
      pagesVisited.push(pageUrl);
    }
  }

  // 3. From the first paginated root only, discover sub-listing URLs to
  //    queue. Skip if we'd already exceed maxPages.
  if (pagesVisited.length < maxPages) {
    try {
      const { html: rootHtml } = await getRawHtml(rootUrl, options);
      for (const sub of findSubListings(rootHtml, rootUrl, rootUrl)) {
        if (!visited.has(sub) && visited.size < maxPages) {
          visited.add(sub);
          queue.push(sub);
        }
      }
    } catch {
      /* root might fail headless render — fine, we already have paginated items */
    }
  }

  // 4. BFS through sub-listings — extract candidates from each.
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
    selectorUsed: firstSelectorUsed || "(no cards detected)",
  };
}
