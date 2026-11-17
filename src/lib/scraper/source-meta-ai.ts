/**
 * AI metadata generator for NewsSource (`defaultTags` & `description`).
 *
 * Optionally fetches a lightweight SSRF-safe HTML snippet from `listingUrl`
 * (title, meta description, top headings) to ground the AI output in what the
 * source actually publishes, then falls back cleanly to source name/URL/category
 * when the site blocks scraping or requires JS rendering.
 */

import * as cheerio from "cheerio";
import { fetchHtml } from "./fetch";
import { sourceLabelFromUrl } from "./source-label";
import { normalizeDefaultTags } from "./source-validation";
import { isSafeHttpUrl } from "@/lib/safe-path";
import { cleanAIShortText } from "@/lib/sanitize";
import { callAI } from "@/lib/ai-client";
import { callPerplexity, isPerplexityConfigured } from "@/lib/perplexity";
import { callLocalAI, getLocalAiConfig, isLocalAiReady } from "@/lib/local-ai";

export type SourceMetaMode = "both" | "tags" | "description";

export interface GenerateSourceMetaInput {
  name?: string;
  listingUrl?: string;
  categoryName?: string | null;
  mode: SourceMetaMode;
  userId?: string;
  userName?: string;
}

export interface GenerateSourceMetaResult {
  defaultTags?: string[];
  description?: string;
  provider: string;
  tokensUsed: number;
  fetchedContextUsed: boolean;
}

export interface ParsedSourceMeta {
  defaultTags?: string[];
  description?: string;
}

const SYSTEM_PROMPT =
  "Kamu adalah editor senior dan spesialis taksonomi berita di Lensaplus (media berita digital Indonesia). " +
  "Tugasmu menyusun deskripsi singkat sumber berita (catatan internal redaksi) dan default tags SEO yang akurat " +
  "dalam Bahasa Indonesia. Jawab HANYA dalam format JSON valid tanpa markdown code fence dan tanpa teks tambahan.";

function stripCitations(s: string): string {
  return s
    .replace(/\s*\[\d+\]/g, "")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

function stripCodeFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

function clampDescription(raw: string): string {
  const withoutInlineBold = stripCitations(raw).replace(/\*\*([^*]+)\*\*/g, "$1");
  const cleaned = cleanAIShortText(withoutInlineBold);
  if (!cleaned) return "";
  if (cleaned.length <= 500) return cleaned;
  const sliced = cleaned.slice(0, 497);
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 300 ? sliced.slice(0, lastSpace) : sliced).trimEnd() + "…";
}

function cleanTagList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const items = raw
    .filter((v): v is string => typeof v === "string")
    .map((v) => stripCitations(v).toLowerCase());
  return normalizeDefaultTags(items).slice(0, 8);
}

/**
 * Parse raw LLM output into normalized `defaultTags` and/or `description`.
 * Resilient to markdown code fences, leading prose around JSON, or plain
 * comma/line fallback when `mode` targets a single field.
 */
export function parseSourceMetaOutput(
  rawText: string,
  mode: SourceMetaMode,
): ParsedSourceMeta {
  const withoutCitations = stripCitations(rawText);
  const cleaned = stripCodeFences(withoutCitations);

  const tryJson = (candidate: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fall through */
    }
    return null;
  };

  let obj = tryJson(cleaned);
  if (!obj) {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) obj = tryJson(objMatch[0]);
  }

  const result: ParsedSourceMeta = {};

  if (obj) {
    if (mode === "both" || mode === "tags") {
      const rawTags = obj.defaultTags ?? obj.tags;
      if (Array.isArray(rawTags)) {
        result.defaultTags = cleanTagList(rawTags);
      } else if (typeof rawTags === "string") {
        result.defaultTags = cleanTagList(rawTags.split(","));
      }
    }
    if (mode === "both" || mode === "description") {
      const rawDesc = obj.description ?? obj.deskripsi;
      if (typeof rawDesc === "string") {
        const desc = clampDescription(rawDesc);
        if (desc) result.description = desc;
      }
    }
    return result;
  }

  // Fallback if the LLM ignored JSON format on single-field generation.
  if (mode === "tags") {
    const arrMatch = cleaned.match(/\[[\s\S]*?\]/);
    if (arrMatch) {
      try {
        const arr = JSON.parse(arrMatch[0]);
        if (Array.isArray(arr)) {
          result.defaultTags = cleanTagList(arr);
          return result;
        }
      } catch {
        /* fall through */
      }
    }
    const split = cleaned
      .split(/\r?\n|,/)
      .map((line) =>
        line
          .replace(/^[\s\-*\d.)]+/, "")
          .replace(/^["'#]+|["']+$/g, "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    result.defaultTags = normalizeDefaultTags(split).slice(0, 8);
  } else if (mode === "description") {
    const desc = clampDescription(cleaned);
    if (desc) result.description = desc;
  }

  return result;
}

/**
 * Best-effort, SSRF-safe fetch of listing page metadata + top headlines.
 * Never throws: returns null when the URL is unreachable, non-HTML, or SPA.
 */
async function fetchListingContext(listingUrl: string): Promise<string | null> {
  if (!isSafeHttpUrl(listingUrl)) return null;
  try {
    const { html } = await fetchHtml(listingUrl, { timeoutMs: 5_000 });
    const $ = cheerio.load(html);
    const pageTitle = $("title").first().text().replace(/\s+/g, " ").trim().slice(0, 140);
    const metaDesc = (
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);

    const headings: string[] = [];
    const seen = new Set<string>();
    $("h1, h2, h3").each((_, el) => {
      if (headings.length >= 5) return;
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length >= 15 && text.length <= 140 && !seen.has(text)) {
        seen.add(text);
        headings.push(text);
      }
    });

    const parts: string[] = [];
    if (pageTitle) parts.push(`Judul halaman: ${pageTitle}`);
    if (metaDesc) parts.push(`Meta deskripsi situs: ${metaDesc}`);
    if (headings.length > 0) parts.push(`Contoh judul/headline: ${headings.join(" | ")}`);

    if (parts.length === 0) return null;
    return parts.join("\n").slice(0, 900);
  } catch {
    return null;
  }
}

function buildUserPrompt(
  input: GenerateSourceMetaInput,
  pageContext: string | null,
): string {
  const brandHint = input.listingUrl ? sourceLabelFromUrl(input.listingUrl) : null;
  const sourceLabel = input.name?.trim() || brandHint || "Sumber Berita";

  const lines: string[] = [
    `Buat metadata redaksi untuk sumber berita berikut:`,
    `- Nama sumber: ${sourceLabel}`,
  ];
  if (input.listingUrl?.trim()) lines.push(`- URL halaman berita: ${input.listingUrl.trim()}`);
  if (input.categoryName?.trim()) lines.push(`- Kategori utama Lensaplus: ${input.categoryName.trim()}`);
  if (pageContext) lines.push(`- Konteks dari halaman situs:\n${pageContext}`);

  lines.push("");
  lines.push(
    `Catatan bahasa: Jika nama sumber, deskripsi situs, atau contoh headline masih berbahasa asing, TERJEMAHKAN dan adaptasikan konsepnya langsung ke dalam Bahasa Indonesia untuk seluruh nilai defaultTags maupun description.`,
  );
  if (input.mode === "both" || input.mode === "tags") {
    lines.push(
      `Aturan defaultTags: 5-8 tag relevan dalam Bahasa Indonesia, huruf kecil semua, tanpa tanda #, maks 40 karakter per tag (campuran nama entitas/instansi, topik utama, dan wilayah/sektor terkait).`,
    );
  }
  if (input.mode === "both" || input.mode === "description") {
    lines.push(
      `Aturan description: 1-2 kalimat ringkas dan informatif dalam Bahasa Indonesia (maks 300 karakter, keras maks 500 karakter) menjelaskan profil sumber berita dan jenis kabar/rilis yang dipantau darinya.`,
    );
  }

  if (input.mode === "both") {
    lines.push(
      `\nFormat output WAJIB JSON valid:\n{"defaultTags": ["tag 1", "tag 2", ...], "description": "Deskripsi singkat sumber berita."}`,
    );
  } else if (input.mode === "tags") {
    lines.push(
      `\nFormat output WAJIB JSON valid:\n{"defaultTags": ["tag 1", "tag 2", ...]}`,
    );
  } else {
    lines.push(
      `\nFormat output WAJIB JSON valid:\n{"description": "Deskripsi singkat sumber berita."}`,
    );
  }

  return lines.join("\n");
}

/**
 * Generate default tags and/or editorial description for a NewsSource.
 * Follows the same multi-engine chain as `/api/ai/generate`:
 * Local AI (if preferred) → Perplexity → Local AI fallback → Anthropic/DeepSeek.
 */
export async function generateNewsSourceMeta(
  input: GenerateSourceMetaInput,
): Promise<GenerateSourceMetaResult> {
  const pageContext = input.listingUrl
    ? await fetchListingContext(input.listingUrl)
    : null;
  const userPrompt = buildUserPrompt(input, pageContext);
  const aiFeature = input.mode === "tags" ? "tag_research" : "seo_description";
  const articleLabel = `Sumber Berita: ${input.name?.trim() || input.listingUrl || "Baru"}`;

  let rawText = "";
  let provider = "";
  let tokensUsed = 0;

  const localai = await getLocalAiConfig();
  async function tryLocalAI(): Promise<void> {
    if (rawText || !isLocalAiReady(localai)) return;
    try {
      const r = await callLocalAI({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 450,
        temperature: 0.4,
        usageMeta: input.userId
          ? {
              userId: input.userId,
              userName: input.userName || "user",
              feature: `local_${aiFeature}`,
              articleTitle: articleLabel,
            }
          : undefined,
      });
      rawText = r.text;
      provider = "local";
      tokensUsed = r.usage.totalTokens;
    } catch {
      /* fall through to next configured provider */
    }
  }

  if (localai.prefer) await tryLocalAI();

  if (!rawText && (await isPerplexityConfigured())) {
    try {
      const r = await callPerplexity({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        contextSize: "low",
        allowCombo: false,
        maxTokens: 450,
        temperature: 0.3,
        usageMeta: input.userId
          ? {
              userId: input.userId,
              userName: input.userName || "user",
              feature: `perplexity_${aiFeature}`,
              articleTitle: articleLabel,
            }
          : undefined,
      });
      rawText = r.text;
      provider = "perplexity";
      tokensUsed = r.usage.totalTokens;
    } catch {
      /* fall through to Local / Anthropic / DeepSeek */
    }
  }

  if (!localai.prefer) await tryLocalAI();

  if (!rawText) {
    const r = await callAI({
      feature: aiFeature,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 450,
      temperature: 0.5,
      userId: input.userId,
      articleTitle: articleLabel,
    });
    rawText = r.text;
    provider = r.provider;
    tokensUsed = r.totalTokens;
  }

  const parsed = parseSourceMetaOutput(rawText, input.mode);
  const hasTags = Boolean(parsed.defaultTags && parsed.defaultTags.length > 0);
  const hasDesc = Boolean(parsed.description && parsed.description.length > 0);

  if (
    (input.mode === "tags" && !hasTags) ||
    (input.mode === "description" && !hasDesc) ||
    (input.mode === "both" && !hasTags && !hasDesc)
  ) {
    throw new Error("AI tidak mengembalikan format tags/deskripsi yang valid.");
  }

  return {
    ...(hasTags ? { defaultTags: parsed.defaultTags } : {}),
    ...(hasDesc ? { description: parsed.description } : {}),
    provider,
    tokensUsed,
    fetchedContextUsed: pageContext !== null,
  };
}
