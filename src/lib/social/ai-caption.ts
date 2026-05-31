/**
 * AI helper to paraphrase an article title into a short, punchy overlay
 * headline and a one-sentence summary — intended for use on the template
 * image (not the caption that goes under the post).
 */

import { callAI } from "@/lib/ai-client";
import { cleanAIShortText } from "@/lib/sanitize";
import type { ArticleForPublish } from "./types";

const SYSTEM_PROMPT =
  "Kamu adalah editor media sosial untuk Kartawarta — media berita digital Bandung dengan fokus bisnis, ekonomi, pemerintahan, dan hukum, plus topik general lain. Tugasmu mem-paraphrase judul artikel menjadi headline overlay gambar yang singkat, kuat, dan mudah dibaca, plus ringkasan satu kalimat. Jawab hanya dalam format JSON, tanpa markdown, tanpa komentar.";

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function safeParseJson<T = unknown>(raw: string): T | null {
  const trimmed = raw.trim();
  // Try direct JSON first.
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* fall through */
  }
  // Extract first {...} block.
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      /* fall through */
    }
  }
  return null;
}

export interface CaptionEnrichment {
  paraphrasedTitle: string;
  shortSummary: string;
}

/**
 * Produce a short paraphrased title (50–80 chars) and a one-sentence summary
 * (80–120 chars) for use inside the template image. Falls back to the raw
 * article title + excerpt on parse failure.
 */
export async function generateCaptionForTemplate(
  article: ArticleForPublish,
): Promise<CaptionEnrichment> {
  const excerpt = article.excerpt ? article.excerpt : stripHtml(article.content).slice(0, 400);

  const userPrompt = `Dari judul + excerpt berikut, buat:
(1) paraphrasedTitle — 50 sampai 80 karakter, bahasa Indonesia natural, cocok untuk overlay pada gambar sosial media. Hindari clickbait berlebihan. Hindari tanda baca akhir seperti titik.
(2) shortSummary — ringkasan padat berisi sebanyak 2 sampai 3 kalimat pendek. TOTAL PANJANG shortSummary WAJIB ANTARA 200 SAMPAI 260 KARAKTER (termasuk spasi). TIDAK BOLEH LEBIH DARI 260 KARAKTER. Jika melebihi, kurangi kata-kata yang tidak penting. Dirangkum langsung dari konten artikel untuk memberi penjelasan yang jelas kepada pembaca.

Format jawaban WAJIB JSON murni (tanpa markdown), persis:
{"paraphrasedTitle":"...","shortSummary":"..."}

JUDUL: ${article.title}
EXCERPT: ${excerpt}`;

  try {
    const result = await callAI({
      feature: "social_caption",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 400,
      temperature: 0.6,
      articleTitle: article.title,
    });

    const parsed = safeParseJson<{
      paraphrasedTitle?: string;
      shortSummary?: string;
    }>(result.text);

    if (parsed?.paraphrasedTitle && parsed?.shortSummary) {
      const cleanTitle = cleanAIShortText(parsed.paraphrasedTitle);
      let cleanSummary = cleanAIShortText(parsed.shortSummary);
      // Hard enforce max length: truncate at word boundary if AI exceeded limit
      if (cleanSummary && cleanSummary.length > 260) {
        cleanSummary = truncateAtWord(cleanSummary, 260);
      }
      if (cleanTitle && cleanSummary) {
        return {
          paraphrasedTitle: cleanTitle,
          shortSummary: cleanSummary,
        };
      }
    }
  } catch {
    // swallow — caller gets fallback below
  }

  return {
    paraphrasedTitle: article.title,
    shortSummary: truncateAtWord((article.excerpt || stripHtml(article.content)), 260),
  };
}

const REEL_QUOTE_SYSTEM_PROMPT =
  "Kamu adalah editor media sosial untuk Kartawarta — media berita digital Bandung. Tugasmu mengambil INTI dari sebuah berita dan menuliskannya sebagai SATU kalimat kutipan pendek yang kuat untuk ditampilkan sebagai teks besar di video Reels Instagram (format vertikal). Jawab hanya dalam format JSON murni, tanpa markdown, tanpa komentar.";

const REEL_QUOTE_MAX_LEN = 90;

/**
 * Produce ONE short, punchy quote (<= ~90 chars) distilled from the article,
 * tuned for legibility as large overlay text on a 9:16 Reel. Falls back to a
 * trimmed paraphrase of the title on any failure. Never throws.
 */
export async function generateReelQuote(
  article: ArticleForPublish,
): Promise<{ quote: string }> {
  const excerpt = article.excerpt ? article.excerpt : stripHtml(article.content).slice(0, 500);

  const userPrompt = `Dari judul + isi berita berikut, buat SATU kalimat kutipan (quote) untuk overlay video Reels:
- Bahasa Indonesia, lugas, kuat, mudah dibaca sekilas.
- MAKSIMAL ${REEL_QUOTE_MAX_LEN} karakter (termasuk spasi). Lebih pendek lebih baik.
- Tanpa tanda kutip pembuka/penutup, tanpa hashtag, tanpa tautan, tanpa emoji.
- Menangkap inti/sudut paling menarik dari berita, bukan sekadar menyalin judul.

Format jawaban WAJIB JSON murni (tanpa markdown), persis:
{"quote":"..."}

JUDUL: ${article.title}
ISI: ${excerpt}`;

  try {
    const result = await callAI({
      feature: "social_caption",
      systemPrompt: REEL_QUOTE_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 200,
      temperature: 0.6,
      articleTitle: article.title,
    });

    const parsed = safeParseJson<{ quote?: string }>(result.text);
    let quote = parsed?.quote ? cleanAIShortText(parsed.quote) : "";
    // Strip any stray surrounding quotes the model may add and hard-cap length.
    quote = quote.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
    if (quote.length > REEL_QUOTE_MAX_LEN) {
      quote = truncateAtWord(quote, REEL_QUOTE_MAX_LEN).replace(/\.$/, "");
    }
    if (quote) return { quote };
  } catch {
    // swallow — fall through to fallback
  }

  // Fallback: trimmed title.
  const fallback = truncateAtWord(article.title, REEL_QUOTE_MAX_LEN).replace(/\.$/, "");
  return { quote: fallback };
}

/**
 * Produce up to `count` SHORT, DISTINCT quotes (each <= ~90 chars) distilled
 * from the article — shown in sequence as the only changing element of a Reel.
 * Falls back to a single trimmed title on failure. Never throws.
 */
export async function generateReelQuotes(
  article: ArticleForPublish,
  count = 3,
): Promise<{ quotes: string[] }> {
  const excerpt = article.excerpt ? article.excerpt : stripHtml(article.content).slice(0, 700);

  const userPrompt = `Dari berita berikut, buat ${count} kalimat kutipan PENDEK yang BERBEDA satu sama lain, untuk ditampilkan BERGANTIAN sebagai teks di video Reels vertikal:
- Bahasa Indonesia, lugas, kuat, mudah dibaca sekilas.
- Setiap kalimat MAKSIMAL ${REEL_QUOTE_MAX_LEN} karakter.
- Masing-masing menyoroti poin/aspek BERBEDA dari berita — jangan saling mengulang.
- Tanpa tanda kutip, tanpa hashtag, tanpa tautan, tanpa emoji, tanpa penomoran.
- Diringkas dari isi berita (bukan sekadar menyalin judul).

Format jawaban WAJIB JSON murni (tanpa markdown), persis:
{"quotes":["...","...","..."]}

JUDUL: ${article.title}
ISI: ${excerpt}`;

  try {
    const result = await callAI({
      feature: "social_caption",
      systemPrompt: REEL_QUOTE_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 400,
      temperature: 0.7,
      articleTitle: article.title,
    });

    const parsed = safeParseJson<{ quotes?: unknown }>(result.text);
    const raw = Array.isArray(parsed?.quotes) ? (parsed!.quotes as unknown[]) : [];
    const cleaned = raw
      .map((q) => (typeof q === "string" ? cleanAIShortText(q) : ""))
      .map((q) => q.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim())
      .map((q) => (q.length > REEL_QUOTE_MAX_LEN ? truncateAtWord(q, REEL_QUOTE_MAX_LEN).replace(/\.$/, "") : q))
      .filter((q) => q.length > 0);
    const quotes = Array.from(new Set(cleaned)).slice(0, count);
    if (quotes.length > 0) return { quotes };
  } catch {
    // swallow — fall through to fallback
  }

  const fallback = truncateAtWord(article.title, REEL_QUOTE_MAX_LEN).replace(/\.$/, "");
  return { quotes: [fallback] };
}

/** Truncate text at word boundary, ensuring it doesn't exceed maxLen chars. */
function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > maxLen * 0.6 ? truncated.slice(0, lastSpace) : truncated;
  // End with period if the last char isn't already punctuation
  const trimmed = cut.replace(/[,;:\s]+$/, "");
  return trimmed.endsWith(".") ? trimmed : trimmed + ".";
}
