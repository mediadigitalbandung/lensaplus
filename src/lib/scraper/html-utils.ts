/**
 * Shared HTML & URL helpers for the news-source scraper pipeline.
 */

import type * as cheerio from "cheerio";
import type { Element as DomElement } from "domhandler";

/**
 * URL tokens reliably identifying site chrome, icons, logos, tracking pixels,
 * or non-editorial placeholders rather than article photography.
 */
const NON_CONTENT_IMAGE_PATTERNS = [
  /logo/i,
  /favicon/i,
  /\bicon[s]?\b/i,
  /watermark/i,
  /placeholder/i,
  /spinner/i,
  /loading/i,
  /\bavatar\b/i,
  /\bsprite\b/i,
  /\bbutton\b/i,
  /\bbadge\b/i,
  /\.svg(\?|$)/i,
  /\bblank\b/i,
  /\bspacer\b/i,
  /\b1x1\b/i,
  /gravatar\.com/i,
];

export function looksLikeContentImageUrl(url: string): boolean {
  return !NON_CONTENT_IMAGE_PATTERNS.some((re) => re.test(url));
}

/**
 * Parse a `srcset` / `data-srcset` attribute and pick the highest-resolution
 * candidate URL. Preserves commas embedded in CDN transform paths (e.g.
 * `/cdn-cgi/image/w=800,q=80/...`) by splitting after width/density descriptors.
 */
export function pickBestFromSrcset(
  rawSrcset: string | undefined,
): string | undefined {
  if (!rawSrcset || !rawSrcset.trim()) return undefined;
  // Split at commas after width/density descriptors (400w, 2x) or commas followed
  // by whitespace + another URL, so commas inside CDN paths (w=800,q=80) stay intact.
  const entries = rawSrcset
    .split(/(?<=\s\d+(?:\.\d+)?[wx])\s*,\s*|\s*,\s+(?=https?:\/\/|\/)/i)
    .map((part) => part.trim())
    .filter(Boolean);

  let bestUrl: string | undefined;
  let bestScore = -1;

  for (const entry of entries) {
    const tokens = entry.split(/\s+/);
    const url = tokens[0];
    if (!url || /^data:/i.test(url)) continue;
    const desc = tokens[1] || "";
    let score = 1;
    const wMatch = desc.match(/^(\d+)w$/i);
    const xMatch = desc.match(/^(\d+(?:\.\d+)?)x$/i);
    if (wMatch) score = parseInt(wMatch[1], 10);
    else if (xMatch) score = Math.round(parseFloat(xMatch[1]) * 1000);
    if (score > bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  }

  return bestUrl;
}

/**
 * Pick the real image URL from an `<img>` element, skipping inline `data:`
 * placeholders that lazy-load plugins put in `src`, checking `data-*`
 * attributes, `srcset`, and any enclosing `<picture><source>` elements.
 */
export function pickImageSrc(
  $el: cheerio.Cheerio<DomElement>,
  $?: cheerio.CheerioAPI,
): string | undefined {
  const candidates = [
    $el.attr("src"),
    $el.attr("data-src"),
    $el.attr("data-lazy-src"),
    $el.attr("data-original"),
    $el.attr("data-actualsrc"),
    $el.attr("data-url"),
  ];
  for (const raw of candidates) {
    const val = raw?.trim();
    if (!val) continue;
    if (/^data:/i.test(val)) continue;
    return val;
  }

  const fromSrcset =
    pickBestFromSrcset($el.attr("data-srcset")) ||
    pickBestFromSrcset($el.attr("srcset"));
  if (fromSrcset) return fromSrcset;

  if ($) {
    const parent = $el.parent();
    if (parent.length > 0 && parent.is("picture")) {
      const sources = parent.find("source").toArray();
      for (const s of sources) {
        const $s = $(s);
        const src =
          pickBestFromSrcset($s.attr("data-srcset")) ||
          pickBestFromSrcset($s.attr("srcset")) ||
          $s.attr("src")?.trim();
        if (src && !/^data:/i.test(src)) return src;
      }
    }
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
