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
(2) shortSummary — satu sampai dua kalimat padat berisi, sekitar 140 sampai 180 karakter, memberi konteks yang jelas kepada pembaca (dioptimalkan agar pas mengisi sekitar 4 baris teks poster).

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
      const cleanSummary = cleanAIShortText(parsed.shortSummary);
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
    shortSummary: (article.excerpt || stripHtml(article.content)).slice(0, 180),
  };
}
