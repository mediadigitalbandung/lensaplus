/**
 * Fetch the body of a single article from its detail URL and return
 * a cleaned, sanitised version ready for AI paraphrasing.
 *
 * Pipeline:
 *   1. Fetch HTML.
 *   2. Run Mozilla Readability to extract the main article (battle-tested,
 *      same engine as Firefox's Reader View).
 *   3. Re-sanitise the resulting HTML through our existing whitelist.
 *   4. Detect language (id vs en) on the cleaned text.
 *   5. Resolve the hero image URL — Readability fields first, then
 *      OG/twitter meta as fallback.
 */

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import type { Element as DomElement } from "domhandler";
import { fetchHtml } from "./fetch";
import { fetchHtmlHeadless } from "./headless";
import { pickImageSrc, looksLikeContentImageUrl } from "./html-utils";
import { detectLanguage } from "./lang";
import { sanitizeHtml } from "@/lib/sanitize";
import type { ScrapedArticle, ScraperOptions } from "./types";

function absolutise(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractMetaImageCandidates(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): { clean: string[]; fallback: string[] } {
  const raw = [
    $('meta[property="og:image:secure_url"]').attr("content"),
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('meta[name="twitter:image:src"]').attr("content"),
    $('link[rel="image_src"]').attr("href"),
  ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);

  const clean: string[] = [];
  const fallback: string[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    const abs = absolutise(c.trim(), baseUrl);
    if (!abs || !/^https?:/i.test(abs) || seen.has(abs)) continue;
    seen.add(abs);
    if (looksLikeContentImageUrl(abs)) clean.push(abs);
    else fallback.push(abs);
  }
  return { clean, fallback };
}

function isTinyTrackingImg($img: cheerio.Cheerio<DomElement>): boolean {
  const w = parseInt($img.attr("width") || "", 10);
  const h = parseInt($img.attr("height") || "", 10);
  if ((Number.isFinite(w) && w > 0 && w <= 24) || (Number.isFinite(h) && h > 0 && h <= 24)) {
    return true;
  }
  return false;
}

function extractImagesFromMarkup(
  $: cheerio.CheerioAPI,
  selectorScope: cheerio.Cheerio<DomElement>,
  baseUrl: string,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  selectorScope.each((_, el) => {
    const $img = $(el) as cheerio.Cheerio<DomElement>;
    if (isTinyTrackingImg($img)) return;
    const src = pickImageSrc($img, $);
    if (!src) return;
    const abs = absolutise(src, baseUrl);
    if (!abs || !/^https?:/i.test(abs) || seen.has(abs)) return;
    if (!looksLikeContentImageUrl(abs)) return;
    seen.add(abs);
    out.push(abs);
  });
  return out;
}

function extractBodyImagesFromHtml(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  return extractImagesFromMarkup($, $("img") as cheerio.Cheerio<DomElement>, baseUrl);
}

function extractDateFromMeta(
  $: cheerio.CheerioAPI,
): Date | undefined {
  const raw =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="pubdate"]').attr("content") ||
    $('meta[name="publishdate"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $("time[datetime]").first().attr("datetime");
  if (!raw) return undefined;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function fetchArticle(
  url: string,
  options: ScraperOptions = {},
): Promise<ScrapedArticle> {
  const { html, finalUrl } = options.useHeadless
    ? await fetchHtmlHeadless(url, {
        timeoutMs: options.timeoutMs,
        waitForSelector: options.contentSelector ?? "article, main, .article-body, .post-content",
        userAgent: options.userAgent,
      })
    : await fetchHtml(url, {
        userAgent: options.userAgent,
        timeoutMs: options.timeoutMs,
      });

  const $ = cheerio.load(html);

  // 1. Try manual content selector first if provided
  let articleHtml = "";
  let articleTitle = "";
  let byline: string | undefined;
  if (options.contentSelector) {
    const nodes = $(options.contentSelector);
    if (nodes.length > 0) {
      articleHtml =
        nodes.length === 1
          ? nodes.first().html() || ""
          : nodes
              .map((_, el) => $.html(el))
              .get()
              .join("\n");
      articleTitle =
        $("h1").first().text().trim() ||
        $('meta[property="og:title"]').attr("content") ||
        $("title").text().trim();
    }
  }

  // 2. Fall back to Readability
  if (!articleHtml || articleHtml.length < 200) {
    const dom = new JSDOM(html, { url: finalUrl });
    const reader = new Readability(dom.window.document, {
      charThreshold: 200,
    });
    const parsed = reader.parse();
    if (parsed) {
      articleHtml = parsed.content || "";
      articleTitle = parsed.title || articleTitle;
      byline = parsed.byline || undefined;
    }
  }

  if (!articleHtml || articleHtml.length < 100) {
    // Final fallback: longest <article> or longest text container
    const articleNode = $("article").first();
    if (articleNode.length > 0) {
      articleHtml = articleNode.html() || "";
    } else {
      // Find element with highest <p> count
      let best = "";
      $("body *").each((_, el) => {
        const $el = $(el);
        const pCount = $el.find("p").length;
        if (pCount >= 3) {
          const html = $el.html() || "";
          if (html.length > best.length) best = html;
        }
      });
      articleHtml = best;
    }
  }

  if (!articleHtml || articleHtml.length < 100) {
    throw new Error("Could not extract article body from page");
  }

  // Title fallback to OG / <title>
  if (!articleTitle) {
    articleTitle =
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      "Untitled";
  }
  articleTitle = articleTitle.replace(/\s+/g, " ").trim().slice(0, 250);

  // Extract raw body images BEFORE sanitizeHtml strips data-src / srcset / <picture>
  const rawBodyImages = extractBodyImagesFromHtml(articleHtml, finalUrl);

  // Sanitise — same whitelist as user-submitted HTML.
  const cleanHtml = sanitizeHtml(articleHtml);

  // Plain text for excerpt + word count + lang detection
  const $body = cheerio.load(cleanHtml);
  const plain = $body.root().text().replace(/\s+/g, " ").trim();

  // Excerpt — first ~180 chars at word boundary
  const excerpt =
    plain.length <= 180 ? plain : plain.slice(0, 177).replace(/\s+\S*$/, "") + "…";

  const wordCount = countWords(plain);

  // Build ordered hero image candidates:
  //   1. Manual imageSelector (if configured)
  //   2. Clean og:image / twitter:image meta tags (most reliable editorial hero)
  //   3. Clean inline images inside extracted article body
  //   4. Hero/featured image containers in full page DOM (when Readability stripped the hero)
  //   5. Any fallback meta image (e.g. generic logo if nothing else exists)
  const heroCandidates: string[] = [];
  const pushUnique = (u: string | undefined) => {
    if (u && !heroCandidates.includes(u)) heroCandidates.push(u);
  };

  if (options.imageSelector) {
    const sel = $(options.imageSelector).first();
    if (sel.length > 0) {
      const src = pickImageSrc(sel as cheerio.Cheerio<DomElement>, $);
      if (src) {
        const abs = absolutise(src, finalUrl);
        if (abs && /^https?:/i.test(abs)) pushUnique(abs);
      }
    }
  }

  const metaImgs = extractMetaImageCandidates($, finalUrl);
  for (const u of metaImgs.clean) pushUnique(u);
  for (const u of rawBodyImages) pushUnique(u);

  const pageHeroImgs = extractImagesFromMarkup(
    $,
    $(
      ".detail__media img, .featured-image img, .post-thumbnail img, article figure img, main figure img, article img, main img",
    ) as cheerio.Cheerio<DomElement>,
    finalUrl,
  );
  for (const u of pageHeroImgs) pushUnique(u);
  for (const u of metaImgs.fallback) pushUnique(u);

  const heroImageUrl = heroCandidates[0];

  const htmlLangHint =
    $("html").attr("lang")?.trim() ||
    $('meta[property="og:locale"]').attr("content")?.trim() ||
    undefined;

  return {
    url: finalUrl,
    title: articleTitle,
    author: byline,
    excerpt,
    contentHtml: cleanHtml,
    wordCount,
    publishedAt: extractDateFromMeta($),
    heroImageUrl,
    heroImageCandidates: heroCandidates,
    bodyImageUrls: rawBodyImages,
    lang: detectLanguage(`${articleTitle} ${plain}`, htmlLangHint),
  };
}
