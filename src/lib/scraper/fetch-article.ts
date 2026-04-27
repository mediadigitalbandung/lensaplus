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
import { fetchHtml } from "./fetch";
import { sanitizeHtml } from "@/lib/sanitize";
import type { ScrapedArticle, ScraperOptions } from "./types";

function detectLang(text: string): "id" | "en" | undefined {
  if (!text) return undefined;
  const sample = text.toLowerCase().slice(0, 4_000);
  // Indonesian function words (high frequency, low overlap with English)
  const idHits =
    (sample.match(/\b(yang|dengan|untuk|tidak|dari|telah|akan|adalah|pada|atau|saja|juga|sudah)\b/g) || [])
      .length;
  const enHits =
    (sample.match(/\b(the|that|with|this|have|from|will|been|were|their|which|would|could)\b/g) || [])
      .length;
  if (idHits === 0 && enHits === 0) return undefined;
  return idHits >= enHits ? "id" : "en";
}

function absolutise(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractHeroFromMeta(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): string | undefined {
  const candidates = [
    $('meta[property="og:image:secure_url"]').attr("content"),
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('link[rel="image_src"]').attr("href"),
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
  for (const c of candidates) {
    const abs = absolutise(c, baseUrl);
    if (abs && /^https?:/i.test(abs)) return abs;
  }
  return undefined;
}

function extractHeroFromHtml(html: string, baseUrl: string): string | undefined {
  const $ = cheerio.load(html);
  // First img inside the article — Readability usually keeps figure>img
  const first = $("img").first();
  if (first.length === 0) return undefined;
  const src =
    first.attr("src") ||
    first.attr("data-src") ||
    first.attr("data-lazy-src");
  if (!src) return undefined;
  const abs = absolutise(src, baseUrl);
  return abs || undefined;
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
  const { html, finalUrl } = await fetchHtml(url, {
    userAgent: options.userAgent,
    timeoutMs: options.timeoutMs,
  });

  const $ = cheerio.load(html);

  // 1. Try manual content selector first if provided
  let articleHtml = "";
  let articleTitle = "";
  let byline: string | undefined;
  if (options.contentSelector) {
    const node = $(options.contentSelector).first();
    if (node.length > 0) {
      articleHtml = node.html() || "";
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

  // Sanitise — same whitelist as user-submitted HTML.
  const cleanHtml = sanitizeHtml(articleHtml);

  // Plain text for excerpt + word count + lang detection
  const $body = cheerio.load(cleanHtml);
  const plain = $body.root().text().replace(/\s+/g, " ").trim();

  // Excerpt — first ~180 chars at word boundary
  const excerpt =
    plain.length <= 180 ? plain : plain.slice(0, 177).replace(/\s+\S*$/, "") + "…";

  const wordCount = countWords(plain);

  // Hero image: Readability output → meta → first <img>
  let heroImageUrl: string | undefined;
  if (options.imageSelector) {
    const sel = $(options.imageSelector).first();
    if (sel.length > 0) {
      const src =
        sel.attr("src") || sel.attr("data-src") || sel.attr("data-lazy-src");
      if (src) {
        const abs = absolutise(src, finalUrl);
        if (abs) heroImageUrl = abs;
      }
    }
  }
  if (!heroImageUrl) {
    heroImageUrl = extractHeroFromHtml(articleHtml, finalUrl);
  }
  if (!heroImageUrl) {
    heroImageUrl = extractHeroFromMeta($, finalUrl);
  }

  return {
    url: finalUrl,
    title: articleTitle,
    author: byline,
    excerpt,
    contentHtml: cleanHtml,
    wordCount,
    publishedAt: extractDateFromMeta($),
    heroImageUrl,
    lang: detectLang(plain),
  };
}
