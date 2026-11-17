/**
 * Shared HTML & URL helpers for the news-source scraper pipeline.
 */

import type * as cheerio from "cheerio";
import type { Element as DomElement } from "domhandler";

/**
 * Pick the real image URL from an `<img>` element, skipping inline `data:`
 * placeholders that lazy-load plugins put in `src` while storing the real
 * image URL in `data-src`, `data-lazy-src`, or `data-original`.
 */
export function pickImageSrc($el: cheerio.Cheerio<DomElement>): string | undefined {
  const candidates = [
    $el.attr("src"),
    $el.attr("data-src"),
    $el.attr("data-lazy-src"),
    $el.attr("data-original"),
  ];
  for (const raw of candidates) {
    const val = raw?.trim();
    if (!val) continue;
    if (/^data:/i.test(val)) continue;
    return val;
  }
  return undefined;
}

/** Normalize a hostname for same-site comparison by stripping leading `www.`. */
export function normalizeWwwHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}

/**
 * Compare two URLs for same-site equivalence, allowing apex ↔ `www.`
 * redirects (e.g. `bankbjb.co.id` ↔ `www.bankbjb.co.id`) while requiring
 * the exact same domain and port.
 */
export function isSameSiteHost(urlA: URL, urlB: URL): boolean {
  if (urlA.port !== urlB.port) return false;
  return normalizeWwwHost(urlA.hostname) === normalizeWwwHost(urlB.hostname);
}
