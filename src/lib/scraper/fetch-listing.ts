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
import { pickImageSrc } from "./html-utils";
import type { ListingItem, ScraperOptions } from "./types";

const COMMON_LISTING_SELECTORS = [
  // Most modern news themes
  "article",
  ".article",
  ".articles article",
  ".news-list .news-item",
  ".berita-list .berita-item",
  ".news-item",
  ".berita-item",
  ".card__post",
  ".media__item",
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

const HEADING_SELECTOR =
  "h1, h2, h3, h4, h5, h6, [class*='title'], [class*='judul'], [class*='headline']";

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
    const linkCount = $el.is("a[href]") ? 1 : $el.find("a[href]").length;
    const imgCount = $el.find("img").length;
    const headingText = $el.find(HEADING_SELECTOR).first().text().trim();
    const anyText = $el.text().replace(/\s+/g, " ").trim();
    if (linkCount > 0 && (headingText.length > 8 || anyText.length >= 25)) score += 3;
    if (imgCount > 0) score += 2;
    if (anyText.length > 40) score += 1;
  });
  return score;
}

function extractCardsFromSet(
  $: cheerio.CheerioAPI,
  cards: cheerio.Cheerio<DomElement>,
  baseUrl: string,
  options: ScraperOptions,
): ListingItem[] {
  const items: ListingItem[] = [];
  const seen = new Set<string>();
  cards.each((_, el) => {
    const item = extractFromCard($, el, baseUrl, options);
    if (item && !seen.has(item.url)) {
      seen.add(item.url);
      items.push(item);
    }
  });
  return items;
}

/**
 * Last-resort fallback for JS/SPA grids (e.g. React/Next.js cards) where
 * cards are `<a href="..."><div><p>Headline...</p></div></a>` with no
 * `<h1>–<h4>` headings or standard class names.
 */
function extractFromArticleAnchors(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  options: ScraperOptions,
): ListingItem[] {
  const items: ListingItem[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    const $a = $(el);
    if ($a.closest("header, nav, footer, aside").length > 0) return;
    const href = $a.attr("href");
    if (!href) return;
    const url = absolutise(href, baseUrl);
    if (!url || !/^https?:\/\//i.test(url)) return;
    if (url === baseUrl || url === baseUrl + "#") return;
    if (!looksLikeArticleUrl(url)) return;
    if (seen.has(url)) return;

    // Prefer an inner heading/paragraph title over concatenated card text
    let title = "";
    $a.find(HEADING_SELECTOR + ", p, strong").each((__, node) => {
      if (title) return;
      const t = $(node).text().replace(/\s+/g, " ").trim();
      if (t.length >= 20 && t.length <= 220) title = t;
    });
    if (!title) {
      title = $a.text().replace(/\s+/g, " ").trim();
    }
    if (!looksLikeHeadline(title)) return;

    let thumbnail: string | undefined;
    const imgEl = options.imageSelector
      ? $a.find(options.imageSelector).first()
      : $a.find("img").first();
    const fallbackImg = imgEl.length > 0 ? imgEl : $a.parent().find("img").first();
    if (fallbackImg.length > 0) {
      const src = pickImageSrc(fallbackImg as cheerio.Cheerio<DomElement>, $);
      if (src) {
        const abs = absolutise(src, baseUrl);
        if (abs && /^https?:\/\//i.test(abs)) thumbnail = abs;
      }
    }

    seen.add(url);
    items.push({
      url,
      title: title.slice(0, 250),
      thumbnail,
    });
  });

  return items;
}

function detectCardsAndExtract(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  options: ScraperOptions,
): { items: ListingItem[]; selector: string } | null {
  for (const selector of COMMON_LISTING_SELECTORS) {
    const cards = $(selector) as cheerio.Cheerio<DomElement>;
    if (cards.length >= 3) {
      const score = scoreCards($, cards);
      if (score >= 9) {
        const items = extractCardsFromSet($, cards, baseUrl, options);
        if (items.length > 0) {
          return { items, selector };
        }
      }
    }
  }

  // Fallback heuristic: find any non-chrome element whose direct children
  // form a repeated link+headline group of length >= 3.
  let best: { items: ListingItem[]; selector: string; rank: number } | null = null;
  for (const el of $("body *").toArray()) {
    const $el = $(el);
    if ($el.is("header, nav, footer, aside")) continue;
    if ($el.closest("header, nav, footer, aside").length > 0) continue;

    const directChildren = $el.children() as cheerio.Cheerio<DomElement>;
    if (directChildren.length < 3) continue;
    let goodChildren = 0;
    directChildren.each((__, c) => {
      const $c = $(c);
      const hasLink = $c.is("a[href]") || $c.find("a[href]").length > 0;
      const hasHeadingOrText =
        $c.find(HEADING_SELECTOR).length > 0 ||
        $c.text().replace(/\s+/g, " ").trim().length >= 25;
      if (hasLink && hasHeadingOrText) {
        goodChildren++;
      }
    });
    if (goodChildren < 3) continue;

    const items = extractCardsFromSet($, directChildren, baseUrl, options);
    if (items.length === 0) continue;
    const score = scoreCards($, directChildren);
    const rank = items.length * 10 + score;
    if (!best || rank > best.rank) {
      const tagName = (el as DomElement).tagName || "div";
      const id = $el.attr("id");
      const cls = ($el.attr("class") || "")
        .split(/\s+/)
        .filter((c) => c.length > 0 && c.length < 30 && !c.includes(":"))
        .slice(0, 2)
        .map((c) => `.${c}`)
        .join("");
      const sel = id ? `#${id} > *` : `${tagName}${cls} > *`;
      best = { items, selector: sel, rank };
    }
  }

  if (best) {
    return { items: best.items, selector: best.selector };
  }

  // Final fallback for modern SPA / anchor-wrapped card layouts
  const anchorItems = extractFromArticleAnchors($, baseUrl, options);
  if (anchorItems.length >= 2) {
    return { items: anchorItems, selector: "auto-anchors" };
  }

  return null;
}

function absolutise(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/**
 * Reject URLs that obviously point at non-news pages — service/product
 * directories, contact widgets, social media share intents.
 *
 * The auto-detector keys off DOM structure (link + heading + image) and
 * cannot tell a service tile ("Pinjaman", "E-Banking") from a news card.
 * On Bank BJB the homepage mixes both. This list catches the bulk of the
 * false positives without needing per-source configuration.
 */
const NON_ARTICLE_URL_PATTERNS = [
  /\/produk(\/|$)/i,
  /\/products?(\/|$)/i,
  /\/layanan(\/|$)/i,
  /\/services?(\/|$)/i,
  /\/kontak(\/|$)/i,
  /\/contact(\/|$)/i,
  /\/tentang(\/|$)/i,
  /\/about(\/|$)/i,
  /\/karir(\/|$)/i,
  /\/career(\/|$)/i,
  /\/lokasi(\/|$)/i,
  /\/cabang(\/|$)/i,
  /\/branch(\/|$)/i,
  /\/atm(\/|$)/i,
  /\/faq(\/|$)/i,
  /\/sitemap(\.|\/|$)/i,
  /\/login(\/|$|\?)/i,
  /\/register(\/|$|\?)/i,
  /\/privacy(\/|$)/i,
  /\/terms?(\/|$)/i,
  /\/syarat(\/|$)/i,
  /\/disclaimer(\/|$)/i,
  /\/wbs(\/|$)/i, // whistleblower system
  /\/pengaduan(\/|$)/i,
  /^(tel|mailto|sms|whatsapp|fb-messenger):/i,
];

function looksLikeArticleUrl(url: string): boolean {
  for (const pattern of NON_ARTICLE_URL_PATTERNS) {
    if (pattern.test(url)) return false;
  }
  return true;
}

/**
 * Reject titles that look like service/menu labels rather than headlines.
 *
 * Heuristics:
 *   - Must have at least 4 words (headlines almost always do; menu items
 *     like "Pinjaman", "bjb Call VoIP" don't).
 *   - Must be at least 20 characters (rules out very short navigation
 *     labels even if they happen to be 4-word).
 *   - Must not be only an exact match of a known service category label.
 */
const SERVICE_LABEL_WORDS = new Set(
  [
    "simpanan", "pinjaman", "investasi", "asuransi", "ebanking", "e-banking",
    "mobilebanking", "mobile-banking", "internetbanking", "internet-banking",
    "deposito", "tabungan", "kartu", "kredit", "atm", "edc",
    "produk", "layanan", "services", "service", "promo", "promosi",
    "kontak", "contact", "tentang", "about", "karir", "career",
    "faq", "bantuan", "support", "wbs", "pengaduan",
    "whatsapp", "call", "voip", "email", "e-mail", "chat",
  ],
);

function looksLikeHeadline(rawTitle: string): boolean {
  const title = rawTitle.trim();
  if (title.length < 20) return false;
  const words = title.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 4) return false;
  // If every "meaningful" token is a service word, it's almost certainly a
  // service tile concatenated by the layout — reject.
  const lowered = title.toLowerCase();
  const tokensWithoutPunct = lowered
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const allService =
    tokensWithoutPunct.length > 0 &&
    tokensWithoutPunct.every((t) => SERVICE_LABEL_WORDS.has(t));
  if (allService) return false;
  return true;
}

function extractFromCard(
  $: cheerio.CheerioAPI,
  card: DomElement,
  baseUrl: string,
  options: ScraperOptions,
): ListingItem | null {
  const $card = $(card);

  // Title: explicit selector wins, else best heading (skipping tiny eyebrow
  // labels), else inner paragraph/anchor text.
  let title = "";
  if (options.titleSelector) {
    title = $card.find(options.titleSelector).first().text().replace(/\s+/g, " ").trim();
  }
  if (!title) {
    let fallbackShort = "";
    $card.find(HEADING_SELECTOR).each((_, h) => {
      if (title) return;
      const t = $(h).text().replace(/\s+/g, " ").trim();
      if (!fallbackShort && t) fallbackShort = t;
      if (t.length >= 15) title = t;
    });
    if (!title && fallbackShort) title = fallbackShort;
  }
  if (!title && $card.is("a")) {
    $card.find("p, strong").each((_, node) => {
      if (title) return;
      const t = $(node).text().replace(/\s+/g, " ").trim();
      if (t.length >= 18 && t.length <= 220) title = t;
    });
    if (!title) title = $card.text().replace(/\s+/g, " ").trim();
  }
  if (!title) {
    $card.find("a[href]").each((_, a) => {
      if (title) return;
      const t = $(a).text().replace(/\s+/g, " ").trim();
      if (t.length > 8) title = t;
    });
  }
  if (!title || title.length < 8) return null;
  // Reject service/menu tiles that share the news-card DOM shape.
  // Skipped only when a manual selector was supplied — the operator can
  // still force-include short headlines via articleSelector + titleSelector.
  if (!options.articleSelector && !looksLikeHeadline(title)) return null;

  // Link: explicit href on the card itself (Persib-style <a class="card">),
  // else anchor inside a heading, else first anchor child.
  let href = $card.is("a") ? $card.attr("href") : undefined;
  if (!href) href = $card.find("h1 a, h2 a, h3 a, h4 a, h5 a, h6 a").first().attr("href");
  if (!href) href = $card.find("a[href]").first().attr("href");
  if (!href) return null;
  const url = absolutise(href, baseUrl);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  // Skip in-page anchors
  if (url === baseUrl + "#") return null;
  // Skip URLs that point at service/contact/legal pages.
  if (!options.articleSelector && !looksLikeArticleUrl(url)) return null;

  // Thumbnail
  let thumbnail: string | undefined;
  const imgEl = options.imageSelector
    ? $card.find(options.imageSelector).first()
    : $card.find("img").first();
  if (imgEl.length > 0) {
    const src = pickImageSrc(imgEl as cheerio.Cheerio<DomElement>, $);
    if (src) {
      const abs = absolutise(src, baseUrl);
      if (abs && /^https?:\/\//i.test(abs)) thumbnail = abs;
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

  // Auto-detect and parse RSS/Atom feeds without misclassifying XHTML pages
  const isRss =
    /<(rss|feed|rdf:RDF)\b/i.test(html) ||
    (html.includes("<channel>") && html.includes("<item>"));
  if (isRss) {
    const rssItems: ListingItem[] = [];
    const seen = new Set<string>();
    const $xml = cheerio.load(html, { xml: true });

    $xml("item, entry").each((_, el) => {
      const $el = $xml(el);
      const href =
        $el.find('link[rel="alternate"][href]').first().attr("href")?.trim() ||
        $el.find("link[href]").not('[rel="self"]').first().attr("href")?.trim() ||
        $el.children("link").first().text().trim() ||
        $el.find("link").first().text().trim();
      let title = $el.find("title").first().text().trim();
      let description = $el.find("description, summary").first().text().trim();

      if (href) {
        const url = absolutise(href, finalUrl);
        if (url && /^https?:\/\//i.test(url) && !seen.has(url)) {
          seen.add(url);
          title = title.replace(/<[^>]*>/g, "").trim();
          description = description.replace(/<[^>]*>/g, "").slice(0, 240).trim();
          rssItems.push({
            url,
            title: title.slice(0, 250),
            snippet: description || undefined,
          });
        }
      }
    });

    if (rssItems.length > 0) {
      return { items: rssItems, selectorUsed: "rss-feed" };
    }
  }

  if (options.articleSelector) {
    const cards = $(options.articleSelector) as cheerio.Cheerio<DomElement>;
    const selectorUsed = options.articleSelector;
    if (cards.length === 0) {
      throw new Error(
        `Manual selector "${options.articleSelector}" matched zero elements`,
      );
    }
    const items = extractCardsFromSet($, cards, finalUrl, options);
    return { items, selectorUsed };
  }

  const detected = detectCardsAndExtract($, finalUrl, options);
  if (!detected) {
    throw new Error(
      "Could not auto-detect article cards on this listing. " +
        "Provide a manual articleSelector or enable headless JS rendering.",
    );
  }

  return { items: detected.items, selectorUsed: detected.selector };
}
