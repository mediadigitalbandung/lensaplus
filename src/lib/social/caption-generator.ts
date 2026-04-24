/**
 * Generate the caption that goes UNDER the social media post (not the text
 * burned into the image). Handles platform-specific length caps and appends
 * hashtags, CTA, and article link.
 */

import { callAI } from "@/lib/ai-client";
import {
  ArticleForPublish,
  CAPTION_MAX_LENGTH,
  Platform,
} from "./types";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

const SYSTEM_PROMPT =
  "Kamu adalah copywriter media sosial untuk media berita hukum Indonesia (Kartawarta). Tulis caption natural, informatif, tidak clickbait, memakai bahasa Indonesia baku yang mudah dibaca. Jangan gunakan markdown/heading/emoji berlebihan. Keluarkan hanya teks caption mentah tanpa pembungkus.";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHashtag(raw: string): string {
  const t = raw.trim().replace(/^#+/, "").replace(/\s+/g, "");
  if (!t) return "";
  return `#${t}`;
}

function targetLengthHint(platform: Platform): string {
  switch (platform) {
    case "INSTAGRAM":
      return "150-300 karakter (Instagram — pendek, punchy)";
    case "TWITTER":
      return "sekitar 180-220 karakter (Twitter — sangat pendek, sisakan ruang untuk link + hashtag dalam batas 280 karakter)";
    case "FACEBOOK":
    default:
      return "300-600 karakter (Facebook — bisa lebih panjang, gaya berita)";
  }
}

function enforceMaxLength(text: string, platform: Platform): string {
  const max = CAPTION_MAX_LENGTH[platform];
  if (text.length <= max) return text;
  // Truncate at a word boundary, leave room for ellipsis.
  const cut = text.slice(0, Math.max(10, max - 3));
  const boundary = cut.lastIndexOf(" ");
  const stopped = boundary > 40 ? cut.slice(0, boundary) : cut;
  return `${stopped}...`;
}

export interface GenerateCaptionOptions {
  article: ArticleForPublish;
  platform: Platform;
  hashtags?: string[];
  cta?: string;
  includeLink?: boolean; // default true
}

/**
 * Produce a platform-ready caption string. Calls `callAI` for the main body
 * then appends CTA + hashtags + link. Falls back to title + excerpt on AI
 * failure so the publish path never dead-locks on the copywriter step.
 */
export async function generateSocialCaption(
  opts: GenerateCaptionOptions,
): Promise<string> {
  const { article, platform, hashtags = [], cta } = opts;
  const includeLink = opts.includeLink !== false;

  const excerpt = article.excerpt || stripHtml(article.content).slice(0, 600);
  const categoryName = article.category?.name || "";

  const userPrompt = `Buat caption sosial media untuk artikel berita berikut.
Platform: ${platform}
Panjang target: ${targetLengthHint(platform)}
Kategori: ${categoryName}

JUDUL: ${article.title}
RINGKASAN: ${excerpt}

Aturan:
- Bahasa Indonesia baku, natural, tidak kaku.
- Sebutkan inti berita dalam 1-2 kalimat pertama.
- Jangan sertakan hashtag atau link — itu akan di-append oleh sistem.
- Jangan tulis tanda "Caption:" atau pembungkus lain.
- Keluarkan hanya teks captionnya.`;

  let body: string;
  try {
    const result = await callAI({
      feature: "social_caption",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 600,
      temperature: 0.7,
      articleTitle: article.title,
    });
    body = result.text.trim();
    if (!body) throw new Error("empty AI response");
  } catch {
    body = `${article.title}. ${excerpt}`.trim();
  }

  // Append CTA
  if (cta && cta.trim().length > 0) {
    body = `${body}\n\n${cta.trim()}`;
  }

  // Append link
  if (includeLink && article.slug) {
    const link = `${SITE_URL.replace(/\/+$/, "")}/berita/${article.slug}`;
    // Twitter: we need to keep the caption under 280 chars with the link.
    body = `${body}\n${link}`;
  }

  // Append hashtags
  const tags = hashtags
    .map(normalizeHashtag)
    .filter((t): t is string => Boolean(t));
  if (tags.length > 0) {
    body = `${body}\n\n${tags.join(" ")}`;
  }

  return enforceMaxLength(body, platform);
}
