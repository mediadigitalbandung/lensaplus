/**
 * generateArticleViaPerplexity — produce a full, web-grounded Indonesian news
 * article (title + body + excerpt + tags + SEO) from a keyword, using ONLY
 * Perplexity (Sonar; model + cost knobs configurable in Pengaturan → AI).
 *
 * Unlike the Claude/DeepSeek paraphrase path (ai-client.ts), this researches the
 * live web and returns the sources it cited, so auto-articles are fresh and
 * attributable rather than reworded copies of an existing article. Composes the
 * Perplexity transport (callPerplexity) with the same delimiter-block draft
 * contract used by the editor's "Riset & Tulis" feature.
 *
 * Throws "PERPLEXITY_NOT_CONFIGURED" (or a user-facing Perplexity error) when the
 * key is missing / billing fails — the caller decides how to handle that.
 */

import {
  callPerplexity,
  getPerplexityInstructions,
  type PerplexitySource,
  type PerplexityImage,
} from "@/lib/perplexity";
import { shouldOffloadSmallFields, deriveSmallFieldsViaDeepSeek } from "@/lib/ai-small-fields";

// Indonesian outlets to bias sourcing toward (allowlist, not exclusive).
const ID_OUTLETS = [
  "kompas.com", "detik.com", "tempo.co", "antaranews.com", "cnnindonesia.com",
  "tribunnews.com", "liputan6.com", "kontan.co.id", "bisnis.com", "republika.co.id",
  "suara.com", "merdeka.com", "jpnn.com", "pikiran-rakyat.com",
];

const SYSTEM_DRAFT =
  "Anda jurnalis senior Kartawarta — media berita digital Bandung (fokus bisnis, ekonomi, " +
  "pemerintahan, hukum, plus topik general). Riset topik dari sumber berita Indonesia yang " +
  "kredibel dan TERBARU, lalu hasilkan PAKET artikel lengkap berbahasa Indonesia yang faktual " +
  "dan SEO-friendly. JANGAN mengarang fakta — hanya yang didukung sumber. " +
  "Jawab PERSIS dengan format blok berpenanda di bawah ini (JANGAN pakai JSON, markdown, atau code fence). " +
  "Tulis setiap penanda di barisnya sendiri, lalu isinya di bawahnya:\n" +
  "===JUDUL===\n(judul artikel menarik, maks 110 karakter)\n" +
  "===RINGKASAN===\n(ringkasan 1-2 kalimat, maks 200 karakter)\n" +
  "===TAGS===\n(5-8 tag relevan dipisah koma)\n" +
  "===SEO_TITLE===\n(judul SEO, maks 60 karakter)\n" +
  "===META===\n(meta description, maks 155 karakter)\n" +
  "===KONTEN===\n(isi artikel sebagai HTML rich-text: <p> paragraf, <h2>/<h3> sub-judul, " +
  "<blockquote> kutipan, <ul>/<li> poin; tanpa tag <html>/<body>, tanpa daftar sumber di akhir)\n" +
  "Jangan menulis apa pun sebelum ===JUDUL=== atau sesudah konten. " +
  "Jangan sertakan penanda sitasi [1][2] di dalam teks.";

export interface PerplexityArticle {
  title: string;
  excerpt: string;
  content: string; // HTML rich-text
  suggestedTags: string[];
  seoTitle: string;
  metaDescription: string;
  sources: PerplexitySource[];
  images: PerplexityImage[];
}

export async function generateArticleViaPerplexity(keyword: string): Promise<PerplexityArticle> {
  // Layer the editor's optional custom voice/style on top of the base prompt.
  const customInstructions = await getPerplexityInstructions();
  let systemPrompt = SYSTEM_DRAFT;
  if (customInstructions) {
    systemPrompt += `\n\nARAHAN PENULIS (WAJIB DIIKUTI): ${customInstructions}`;
  }

  const userPrompt =
    `Topik artikel: ${keyword}. Riset berita Indonesia TERBARU tentang topik ini, lalu hasilkan ` +
    `paket artikel lengkap sesuai format blok berpenanda. Pastikan faktual, kronologis (lead 5W+1H ` +
    `di paragraf pertama), paragraf pendek, dan HANYA memuat hal yang didukung sumber.`;

  const result = await callPerplexity({
    systemPrompt,
    userPrompt,
    recency: "month",
    domains: ID_OUTLETS,
    contextSize: "high",
    maxTokens: 5000,
    temperature: 0.3,
    includeImages: true,
    allowCombo: true, // full-article generation → Combo applies if enabled
    // Auto-article cron previously logged NO Perplexity cost — record it now
    // (per stage, so Combo prices correctly). Attributed to the source keyword.
    usageMeta: { userId: "system", userName: "system", feature: "perplexity_draft", articleTitle: keyword },
  });

  // Parse the delimiter blocks (robust against the long HTML body — no JSON
  // escaping breakage). Mirrors the parser in /api/ai/research.
  const cleaned = result.text
    .replace(/\[\d+\]/g, "")
    .replace(/^```(?:json|html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const section = (marker: string): string => {
    const re = new RegExp(
      `===${marker}===\\s*\\n?([\\s\\S]*?)(?=\\n?===(?:JUDUL|RINGKASAN|TAGS|SEO_TITLE|META|KONTEN)===|$)`,
      "i",
    );
    const m = cleaned.match(re);
    return m ? m[1].trim() : "";
  };

  const hasMarkers = /===JUDUL===/i.test(cleaned);
  const tagsStr = section("TAGS").replace(/^\[|\]$/g, "").replace(/"/g, "").trim();

  const title = section("JUDUL");
  // If the model ignored the markers entirely, fall back to the whole reply as body.
  const content = section("KONTEN") || (hasMarkers ? "" : cleaned);
  let excerpt = section("RINGKASAN");
  let suggestedTags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
  let seoTitle = section("SEO_TITLE");
  let metaDescription = section("META");

  // Cost combo: regenerate the small SEO metadata with cheap DeepSeek (opt-in).
  // Best-effort — on any miss we keep Perplexity's own fields.
  if (content && (await shouldOffloadSmallFields())) {
    const sf = await deriveSmallFieldsViaDeepSeek(title, content);
    if (sf) {
      excerpt = sf.excerpt || excerpt;
      suggestedTags = sf.tags.length ? sf.tags : suggestedTags;
      seoTitle = sf.seoTitle || seoTitle;
      metaDescription = sf.metaDescription || metaDescription;
    }
  }

  return {
    title,
    excerpt,
    content,
    suggestedTags,
    seoTitle,
    metaDescription,
    sources: result.sources,
    images: result.images,
  };
}
