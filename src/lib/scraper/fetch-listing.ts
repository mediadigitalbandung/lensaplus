/**
 * Extract a list of article candidates from a news listing URL
 * (e.g. https://www.bankbjb.co.id/page/berita).
 *
 * Strategy:
 *   1. If a manual `articleSelector` is supplied, use it directly.
 *   2. Else auto-detect: walk the DOM, look for a container that holds
 *      multiple repeated children, each containing an <a> with a
 *      reasonably long heading text and (preferably) an <img>.
 *   3. From each card extract: link, title, optional thumbnail and
 *      optional snippet.
 *
 * Always emits absolute URLs.
 */

import * as cheerio from "cheerio";
import type { Element as DomElement } from "domhandler";
import { fetchHtml } from "./fetch";
import { fetchHtmlHeadless } from "./headless";
import type { ListingItem, ScraperOptions } from "./types";

interface CandidateContainer {
  selector: string;
  children: cheerio.Cheerio<DomElement>;
  score: number;
}

const COMMON_LISTING_SELECTORS = [
  // Most modern news themes
  "article",
  ".article",
  ".articles article",
  ".news-list .news-item",
  ".berita-list .berita-item",
  ".post",
  ".post-item",
  ".card-news",
  ".news-card",
  // Bootstrap-y layouts
  ".row .col article",
  // CMS-specific
  ".td-module-container",
  ".jeg_post",
  ".elementor-post",
];

/**
 * Score a set of candidate cards: more cards with link+image+heading-text
 * scores higher.
 */
function scoreCards(
  $: cheerio.CheerioAPI,
  cards: cheerio.Cheerio<DomElement>,
): number {
  let score = 0;
  cards.each((_, el) => {
    const $el = $(el);
    const linkCount = $el.find("a[href]").length;
    const imgCount = $el.find("img").length;
    const headingText = $el.find("h1,h2,h3,h4").first().text().trim();
    const anyText = $el.text().trim();
    if (linkCount > 0 && headingText.length > 8) score += 3;
    if (imgCount > 0) score += 2;
    if (anyText.length > 40) score += 1;
  });
  return score;
}

function detectCards(
  $: cheerio.CheerioAPI,
): CandidateContainer | null {
  for (const selector of COMMON_LISTING_SELECTORS) {
    const cards = $(selector) as cheerio.Cheerio<DomElement>;
    if (cards.length >= 3) {
      const score = scoreCards($, cards);
      // 3+ cards with reasonable score is enough
      if (score >= 9) {
        return { selector, children: cards, score };
      }
    }
  }

  // Fallback heuristic: find any element whose direct children form a
  // repeated link+heading group of length >= 3.
  let best: CandidateContainer | null = null;
  $("body *").each((_, el) => {
    const $el = $(el);
    const directChildren = $el.children() as cheerio.Cheerio<DomElement>;
    if (directChildren.length < 3) return;
    // Check that most direct children contain at least one anchor + heading
    let goodChildren = 0;
    directChildren.each((__, c) => {
      const $c = $(c);
      if ($c.find("a[href]").length > 0 && $c.find("h1,h2,h3,h4").length > 0) {
        goodChildren++;
      }
    });
    if (goodChildren < 3) return;
    const score = scoreCards($, directChildren);
    if (!best || score > best.score) {
      const tagName = (el as DomElement).tagName || "div";
      const id = $el.attr("id");
      const cls = ($el.attr("class") || "")
        .split(/\s+/)
        .filter((c) => c.length > 0 && c.length < 30)
        .slice(0, 2)
        .map((c) => `.${c}`)
        .join("");
      const sel = id ? `#${id} > *` : `${tagName}${cls} > *`;
      best = { selector: sel, children: directChildren, score };
    }
  });
  return best;
}

function absolutise(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractFromCard(
  $: cheerio.CheerioAPI,
  card: DomElement,
  baseUrl: string,
  options: ScraperOptions,
): ListingItem | null {
  const $card = $(card);

  // Title: explicit selector wins, else first heading, else first long anchor
  let title = "";
  if (options.titleSelector) {
    title = $card.find(options.titleSelector).first().text().trim();
  }
  if (!title) title = $card.find("h1,h2,h3,h4").first().text().trim();
  if (!title) {
    const anchorText = $card.find("a[href]").first().text().trim();
    if (anchorText.length > 8) title = anchorText;
  }
  if (!title || title.length < 8) return null;

  // Link: use anchor inside heading if present, else first anchor
  let href = $card.find("h1 a, h2 a, h3 a, h4 a").first().attr("href");
  if (!href) href = $card.find("a[href]").first().attr("href");
  if (!href) return null;
  const url = absolutise(href, baseUrl);
  if (!url) return null;
  // Skip in-page anchors and javascript: pseudo links
  if (url.startsWith("javascript:") || url === baseUrl + "#") return null;

  // Thumbnail
  let thumbnail: string | undefined;
  const imgEl = options.imageSelector
    ? $card.find(options.imageSelector).first()
    : $card.find("img").first();
  if (imgEl.length > 0) {
    const src =
      imgEl.attr("src") ||
      imgEl.attr("data-src") ||
      imgEl.attr("data-lazy-src") ||
      imgEl.attr("data-original");
    if (src) {
      const abs = absolutise(src, baseUrl);
      if (abs) thumbnail = abs;
    }
  }

  // Snippet
  const snippet = $card
    .find("p")
    .first()
    .text()
    .trim()
    .slice(0, 240);

  return {
    url,
    title: title.slice(0, 250),
    thumbnail,
    snippet: snippet || undefined,
  };
}

export async function fetchListing(
  listingUrl: string,
  options: ScraperOptions = {},
): Promise<{ items: ListingItem[]; selectorUsed: string }> {
  const { html, finalUrl } = options.useHeadless
    ? await fetchHtmlHeadless(listingUrl, {
        timeoutMs: options.timeoutMs,
        waitForSelector: options.waitForSelector ?? options.articleSelector ?? null,
        userAgent: options.userAgent,
      })
    : await fetchHtml(listingUrl, {
        userAgent: options.userAgent,
        timeoutMs: options.timeoutMs,
      });
  const $ = cheerio.load(html);

  let cards: cheerio.Cheerio<DomElement>;
  let selectorUsed: string;
  if (options.articleSelector) {
    cards = $(options.articleSelector) as cheerio.Cheerio<DomElement>;
    selectorUsed = options.articleSelector;
    if (cards.length === 0) {
      throw new Error(
        `Manual selector "${options.articleSelector}" matched zero elements`,
      );
    }
  } else {
    const detected = detectCards($);
    if (!detected) {
      throw new Error(
        "Could not auto-detect article cards on this listing. " +
          "Provide a manual articleSelector.",
      );
    }
    cards = detected.children;
    selectorUsed = detected.selector;
  }

  const items: ListingItem[] = [];
  const seen = new Set<string>();
  cards.each((_, el) => {
    const item = extractFromCard($, el, finalUrl, options);
    if (item && !seen.has(item.url)) {
      seen.add(item.url);
      items.push(item);
    }
  });

  return { items, selectorUsed };
}
