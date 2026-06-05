/**
 * Cost combo: derive an article's SMALL metadata fields (excerpt, tags, SEO
 * title, meta description) with the cheap DeepSeek model instead of paying
 * Perplexity for them. These fields are summaries of the body — they don't need
 * web grounding, so a tiny DeepSeek call (a few hundred tokens) does the job for
 * a fraction of the cost.
 *
 * Opt-in via SystemSetting `perplexity_small_fields_deepseek` = "true", and only
 * active when a DeepSeek key is configured. Both the editor "Riset & Tulis"
 * route and the auto-article cron use this.
 */

import { prisma } from "@/lib/prisma";
import { callAI } from "@/lib/ai-client";

export interface SmallFields {
  excerpt: string;
  tags: string[];
  seoTitle: string;
  metaDescription: string;
}

/** True only when the toggle is on AND a DeepSeek key exists (else no-op). */
export async function shouldOffloadSmallFields(): Promise<boolean> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["perplexity_small_fields_deepseek", "deepseek_api_key"] } },
      select: { key: true, value: true },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, (r.value ?? "").trim()]));
    if (map.perplexity_small_fields_deepseek !== "true") return false;
    return Boolean(map.deepseek_api_key || process.env.DEEPSEEK_API_KEY);
  } catch {
    return false;
  }
}

const SYSTEM =
  "Anda editor SEO Kartawarta (media berita Bandung). Dari JUDUL + ISI artikel, hasilkan metadata " +
  "ringkas berbahasa Indonesia. HANYA rangkum dari isi — jangan menambah fakta baru. Jawab PERSIS " +
  "dengan format blok berpenanda, tiap penanda di barisnya sendiri lalu isinya di bawahnya, tanpa " +
  "teks lain:\n" +
  "===RINGKASAN===\n(1-2 kalimat lead, maks 200 karakter)\n" +
  "===TAGS===\n(5-8 tag relevan dipisah koma)\n" +
  "===SEO_TITLE===\n(judul SEO menarik, maks 60 karakter)\n" +
  "===META===\n(meta description, maks 155 karakter)";

function section(text: string, marker: string): string {
  const re = new RegExp(
    `===${marker}===\\s*\\n?([\\s\\S]*?)(?=\\n?===(?:RINGKASAN|TAGS|SEO_TITLE|META)===|$)`,
    "i",
  );
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

/**
 * Generate the small fields from a finished article body via DeepSeek. Returns
 * null on any failure so the caller can keep Perplexity's own fields as a
 * fallback (we never block the draft on this optimisation).
 */
export async function deriveSmallFieldsViaDeepSeek(
  title: string,
  contentHtml: string,
  userId?: string,
  articleTitle?: string,
): Promise<SmallFields | null> {
  const plain = contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
  if (plain.length < 50) return null;
  try {
    const res = await callAI({
      feature: "seo_description",
      forceProvider: "deepseek",
      maxTokens: 400,
      temperature: 0.4,
      systemPrompt: SYSTEM,
      userPrompt: `JUDUL: ${title}\n\nISI ARTIKEL:\n${plain}`,
      userId,
      // Attribute the DeepSeek cost to the article so per-article stats include it.
      articleTitle: articleTitle ?? title,
    });
    const out = res.text
      .replace(/^```(?:json|html)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const tagsStr = section(out, "TAGS").replace(/^\[|\]$/g, "").replace(/"/g, "").trim();
    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
    const fields: SmallFields = {
      excerpt: section(out, "RINGKASAN").slice(0, 500),
      tags,
      seoTitle: section(out, "SEO_TITLE").slice(0, 70),
      metaDescription: section(out, "META").slice(0, 160),
    };
    // Need at least one usable field, else treat as failure.
    if (!fields.excerpt && !fields.seoTitle && !fields.metaDescription && tags.length === 0) {
      return null;
    }
    return fields;
  } catch {
    return null;
  }
}
