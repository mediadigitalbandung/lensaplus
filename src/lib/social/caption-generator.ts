/**
 * Generate the caption that goes UNDER the social media post (not the text
 * burned into the image). Handles platform-specific length caps and appends
 * hashtags, CTA, and article link.
 */

import { callAI } from "@/lib/ai-client";
import { cleanAILongText } from "@/lib/sanitize";
import {
  ArticleForPublish,
  CAPTION_MAX_LENGTH,
  Platform,
} from "./types";

const SITE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("nip.io") ||
      parsed.hostname.includes("localhost") ||
      parsed.hostname.includes("127.0.0.1") ||
      /^[0-9.]+$/.test(parsed.hostname)
    ) {
      return "https://kartawarta.com";
    }
  } catch {}
  return url;
})();

const SYSTEM_PROMPT =
  "Kamu adalah copywriter media sosial untuk Kartawarta — media berita digital Bandung dengan fokus bisnis, ekonomi, pemerintahan, dan hukum, plus topik general (olahraga, hiburan, teknologi, dll). Tulis caption natural, informatif, tidak clickbait, memakai bahasa Indonesia baku yang mudah dibaca. Tulis sesuai format yang diminta secara ketat.";

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
    case "THREADS":
      return "100-250 karakter (Threads — sangat pendek, sisakan ruang untuk link dalam batas 500 karakter)";
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

async function getActiveTrendingKeywords(): Promise<string[]> {
  try {
    const googleRes = await fetch(
      "https://trends.google.com/trending/rss?geo=ID",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!googleRes.ok) return [];
    const xml = await googleRes.text();
    const itemTitles = xml.match(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g);
    if (!itemTitles) return [];
    return itemTitles
      .map((t) => {
        const titleMatch = t.match(/<title>([\s\S]*?)<\/title>/);
        if (!titleMatch) return "";
        return titleMatch[1]
          .replace(/&amp;/g, "&")
          .replace(/&apos;/g, "'")
          .replace(/&quot;/g, '"')
          .trim();
      })
      .filter((t) => t.length > 0 && t.length <= 40);
  } catch {
    return [];
  }
}

export interface GenerateCaptionOptions {
  article: ArticleForPublish;
  platform: Platform;
  hashtags?: string[];
  cta?: string;
  includeLink?: boolean; // default true
}

import { prisma } from "@/lib/prisma";

/**
 * Produce a platform-ready caption string. Calls `callAI` for the main body
 * then appends CTA + hashtags + link according to the caption template in settings.
 * Falls back to title + excerpt on AI failure.
 */
export async function generateSocialCaption(
  opts: GenerateCaptionOptions,
): Promise<string> {
  const { article, platform, hashtags = [], cta } = opts;
  const includeLink = opts.includeLink !== false;

  const excerpt = article.excerpt || stripHtml(article.content).slice(0, 600);
  const categoryName = article.category?.name || "";

  // Fetch active Google Trends in Indonesia to feed the AI context
  const trendingKeywords = await getActiveTrendingKeywords();

  const userPrompt = `Buat caption sosial media untuk artikel berita berikut.
Platform: ${platform}
Panjang target: ${targetLengthHint(platform)}
Kategori: ${categoryName}

JUDUL: ${article.title}
RINGKASAN: ${excerpt}

TREN TERKINI DI INDONESIA SAAT INI (Google Trends):
${trendingKeywords.length > 0 ? trendingKeywords.slice(0, 15).join(", ") : "Tidak ada data tren langsung"}

Aturan:
1. Bahasa Indonesia baku, natural, tidak kaku.
2. Sebutkan inti berita dalam 1-2 kalimat pertama.
3. Lakukan Analisis Bobot Relevansi (Word Weight Relevance Analysis) secara mendalam antara artikel ini dengan daftar TREN TERKINI (Google Trends) di atas:
   a. Evaluasi setiap kata kunci/topik dalam TREN TERKINI. Berikan "bobot keterkaitan" (relevance weight) berdasarkan kecocokan konsep, kategori, nama tokoh, lokasi, atau instansi yang sedang viral dengan isi berita Kartawarta ini.
   b. Prioritaskan 3-5 kata kunci/topik yang memiliki bobot keterkaitan tertinggi, lalu ubah kata kunci tersebut menjadi hashtag viral yang bersih (CamelCase, tanpa spasi/simbol, contoh: jika trennya "persib vs madura united", ubah menjadi #Persib atau #MaduraUnited).
   c. Jika tidak ada topik dalam TREN TERKINI yang memiliki bobot keterkaitan yang kuat dengan berita (bobot rendah), jangan memaksakan memakai tren yang tidak relevan. Sebagai gantinya, ciptakan 3-5 hashtag kreatif/spesifik bertema viral yang berkaitan langsung dengan berita tersebut (misalnya, nama tempat/isu di Bandung/Jawa Barat seperti #KulinerBandung, #InfoJabar, atau topik berita spesifik seperti #PajakKini, #EkonomiBandung).
4. Format output Anda wajib terbagi menjadi dua bagian seperti di bawah ini secara persis:

[CAPTION]
(Tulis teks caption di sini tanpa hashtag atau link)

[HASHTAGS]
(Tulis 3-5 hashtag tambahan yang sedang viral/trending berkaitan dengan berita di sini, pisahkan dengan spasi, contoh: #TimnasDay #Pilkada2026)
`;

  let body: string;
  let aiHashtags: string[] = [];

  try {
    const result = await callAI({
      feature: "social_caption",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 600,
      temperature: 0.7,
      articleTitle: article.title,
    });
    
    const resultText = result.text || "";
    const captionMatch = resultText.match(/\[CAPTION\]([\s\S]*?)\[HASHTAGS\]/i);
    const hashtagsMatch = resultText.match(/\[HASHTAGS\]([\s\S]*)/i);

    if (captionMatch) {
      body = cleanAILongText(captionMatch[1]);
    } else {
      body = cleanAILongText(resultText);
    }

    if (hashtagsMatch) {
      aiHashtags = hashtagsMatch[1]
        .split(/[,\s\n]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => t.replace(/^#+/, ""));
    }

    if (!body) throw new Error("empty AI response");
  } catch {
    body = `${article.title}. ${excerpt}`.trim();
  }

  // Load global settings for captionTemplate
  let captionTemplate: string | null = null;
  try {
    const globalSettings = await prisma.socialMediaSettings.findUnique({
      where: { id: "global" },
    });
    captionTemplate = globalSettings?.captionTemplate || null;
  } catch (dbErr) {
    console.error("[caption-generator] Failed to load captionTemplate from DB:", dbErr);
  }

  // Define default structured template
  const defaultTemplate = `{{title}}\n\n{{summary}}\n\nBaca selengkapnya di: {{link}}\n\n{{cta}}\n\n{{hashtags}}`;
  const template = (captionTemplate && captionTemplate.trim()) || defaultTemplate;

  // Build values for replacement
  const link = (includeLink && article.slug) ? `${SITE_URL.replace(/\/+$/, "")}/berita/${article.slug}` : "";
  
  // Combine user-provided tags (default + article tags) with AI-generated trending tags
  const combinedTagsList = [
    ...hashtags,
    ...aiHashtags,
  ];

  const tagsList = combinedTagsList
    .map(normalizeHashtag)
    .filter((t): t is string => Boolean(t));
  const tags = Array.from(new Set(tagsList)).join(" ");

  if (platform === "THREADS") {
    const titlePart = `[ ${article.title} ]`;
    const linkPart = link ? `Baca selengkapnya di: ${link}` : "";
    const titleSpacing = body ? "\n\n" : "";
    const linkSpacing = (body && linkPart) ? "\n\n" : (titlePart && linkPart) ? "\n\n" : "";
    
    const staticLength = titlePart.length + titleSpacing.length + linkSpacing.length + linkPart.length;
    const allowedBodyLength = 500 - staticLength;
    
    let processedBody = body || "";
    if (processedBody.length > allowedBodyLength) {
      const cut = processedBody.slice(0, Math.max(10, allowedBodyLength - 3));
      const boundary = cut.lastIndexOf(" ");
      const stopped = boundary > 40 ? cut.slice(0, boundary) : cut;
      processedBody = `${stopped}...`;
    }
    
    const resolvedCaption = `${titlePart}${titleSpacing}${processedBody}${linkSpacing}${linkPart}`.trim();
    return resolvedCaption;
  }

  // Resolve placeholders in the custom template
  const resolvedCaption = template
    .replace(/\{\{title\}\}/g, article.title || "")
    .replace(/\{\{summary\}\}/g, body || "")
    .replace(/\{\{link\}\}/g, link)
    .replace(/\{\{cta\}\}/g, (cta && cta.trim()) || "")
    .replace(/\{\{hashtags\}\}/g, tags)
    // Clean up empty lines or double line breaks that occurred due to missing fields
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return enforceMaxLength(resolvedCaption, platform);
}
