/**
 * Best-effort batch translation & concept paraphrasing for Preview listings
 * when a NewsSource publishes in a non-Indonesian language.
 */

import { callAI } from "@/lib/ai-client";
import { cleanAIShortText } from "@/lib/sanitize";
import { languageLabelId } from "./lang";
import type { ListingItem } from "./types";

const MAX_PREVIEW_TRANSLATE = 35;

export interface TranslatedListingFields {
  originalTitle?: string;
  originalSnippet?: string;
  translated?: boolean;
}

type PreviewTranslatable = Pick<ListingItem, "url" | "title" | "snippet"> &
  TranslatedListingFields;

const SYSTEM_PROMPT =
  "Kamu adalah editor berita Lensaplus (media berita digital Indonesia). " +
  "Tugasmu menerjemahkan judul dan cuplikan berita berbahasa asing LANGSUNG ke dalam Bahasa Indonesia jurnalistik yang natural, ringkas, dan menarik (bukan terjemahan kaku kata per kata, melainkan parafrase konsep yang akurat sesuai fakta judul). " +
  "Jawab HANYA dalam format JSON array valid tanpa markdown code fence dan tanpa teks tambahan.";

interface AiBatchRow {
  idx?: unknown;
  title?: unknown;
  snippet?: unknown;
}

function extractJsonArray(raw: string): AiBatchRow[] | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  const tryParse = (s: string): AiBatchRow[] | null => {
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? (parsed as AiBatchRow[]) : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) return tryParse(match[0]);
  return null;
}

/**
 * Translate and concept-paraphrase non-Indonesian preview headlines/snippets
 * into natural Indonesian. Never throws — returns original items untouched if
 * AI is unconfigured, disabled, or times out.
 */
export async function translatePreviewItems<T extends PreviewTranslatable>(
  items: T[],
  sourceLang: string,
  opts?: { userId?: string; userName?: string },
): Promise<{ items: Array<T & TranslatedListingFields>; applied: boolean }> {
  if (!items.length || !sourceLang || sourceLang === "id") {
    return { items, applied: false };
  }

  const batch = items.slice(0, MAX_PREVIEW_TRANSLATE);
  const payload = batch.map((item, idx) => ({
    idx,
    title: item.title,
    ...(item.snippet ? { snippet: item.snippet.slice(0, 220) } : {}),
  }));

  const langName = languageLabelId(sourceLang);
  const userPrompt =
    `Terjemahkan dan parafrase konsep daftar artikel berita berbahasa ${langName} di bawah ini ke Bahasa Indonesia jurnalistik sesuai PUEBI/EYD.\n` +
    `- Pertahankan keakuratan nama tokoh, perusahaan, angka, dan lokasi.\n` +
    `- Kembalikan JSON array dengan struktur PERSIS: [{"idx":0,"title":"...","snippet":"..."}, ...].\n` +
    `- Jika item tidak punya snippet, isi snippet dengan "".\n\n` +
    `DATA:\n${JSON.stringify(payload)}`;

  try {
    const res = await callAI({
      feature: "article_draft",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2_000,
      temperature: 0.4,
      timeoutMs: 20_000,
      skipInstructions: true,
      userId: opts?.userId,
      userName: opts?.userName,
      articleTitle: `Preview terjemahan (${langName})`,
    });

    const rows = extractJsonArray(res.text);
    if (!rows || rows.length === 0) {
      return { items, applied: false };
    }

    const byIdx = new Map<number, { title?: string; snippet?: string }>();
    for (const r of rows) {
      if (typeof r?.idx !== "number" || !Number.isInteger(r.idx)) continue;
      const t =
        typeof r.title === "string"
          ? cleanAIShortText(r.title).slice(0, 250)
          : "";
      const s =
        typeof r.snippet === "string"
          ? cleanAIShortText(r.snippet).slice(0, 260)
          : "";
      if (t) byIdx.set(r.idx, { title: t, snippet: s || undefined });
    }

    if (byIdx.size === 0) {
      return { items, applied: false };
    }

    const updated = items.map((item, idx) => {
      const tr = byIdx.get(idx);
      if (!tr?.title) return item;
      return {
        ...item,
        originalTitle: item.title,
        ...(item.snippet ? { originalSnippet: item.snippet } : {}),
        title: tr.title,
        ...(tr.snippet ? { snippet: tr.snippet } : {}),
        translated: true,
      };
    });

    return { items: updated, applied: true };
  } catch {
    return { items, applied: false };
  }
}
