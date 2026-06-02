/**
 * POST /api/ai/research
 * Body: { topic: string, mode?: "draft" | "research", notes?: string }
 *
 * Uses Perplexity (Sonar) to research a news topic on the live web and return:
 *   - mode "draft" (default): a ready-to-edit article in HTML (<p>/<h2>/<blockquote>/<ul>)
 *   - mode "research": a sourced briefing (facts + angles) to write from
 * plus the real sources Perplexity cited (title + url + date).
 *
 * Auth: writers+ (same roles allowed to create articles).
 */

import { NextRequest } from "next/server";
import { requireAuth, successResponse, errorResponse, ApiError, logAudit } from "@/lib/api-utils";
import { aiRateLimit } from "@/lib/rate-limit";
import { callPerplexity } from "@/lib/perplexity";

// Indonesian outlets to bias sourcing toward (allowlist, not exclusive — Perplexity
// still ranks within these first). Kept broad so niche topics aren't starved.
const ID_OUTLETS = [
  "kompas.com", "detik.com", "tempo.co", "antaranews.com", "cnnindonesia.com",
  "tribunnews.com", "liputan6.com", "kontan.co.id", "bisnis.com", "republika.co.id",
  "suara.com", "merdeka.com", "jpnn.com", "pikiran-rakyat.com",
];

const SYSTEM_DRAFT =
  "Anda jurnalis senior Kartawarta — media berita digital Bandung (fokus bisnis, ekonomi, " +
  "pemerintahan, hukum, plus topik general). Riset topik dari sumber berita Indonesia yang " +
  "kredibel dan TERBARU, lalu tulis draf artikel berita berbahasa Indonesia yang faktual, " +
  "mengalir, dan enak dibaca. JANGAN mengarang fakta — hanya tulis yang didukung sumber. " +
  "Output WAJIB HTML rich-text: <p> untuk paragraf, <h2>/<h3> untuk sub-judul, <blockquote> " +
  "untuk kutipan penting, <ul>/<li> untuk poin. JANGAN sertakan tag <html>/<body>, markdown, " +
  "atau code fence. Jangan tulis daftar sumber/referensi di akhir (sumber ditangani terpisah).";

const SYSTEM_RESEARCH =
  "Anda periset berita untuk Kartawarta. Riset topik dari sumber Indonesia yang kredibel dan " +
  "terbaru, lalu rangkum sebagai bahan tulis: fakta kunci (apa/siapa/kapan/di mana/mengapa), " +
  "angka/kutipan penting, konteks, dan beberapa angle menarik. Bahasa Indonesia, ringkas, " +
  "berbasis fakta. Output HTML rich-text (<h2>/<p>/<ul>/<li>). Tanpa markdown/code fence.";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { success: allowed } = aiRateLimit(session.user.id);
    if (!allowed) {
      throw new ApiError("Batas penggunaan AI tercapai (20 request/jam). Coba lagi nanti.", 429);
    }

    const body = await req.json().catch(() => ({}));
    const topic = (body.topic ?? "").toString().trim();
    const mode = body.mode === "research" ? "research" : "draft";
    const notes = (body.notes ?? "").toString().trim();
    if (!topic) throw new ApiError("Topik/judul wajib diisi", 400);

    const userPrompt =
      mode === "draft"
        ? `Topik artikel: ${topic}.${notes ? ` Arahan tambahan: ${notes}.` : ""} ` +
          `Tulis draf artikel berita lengkap berbahasa Indonesia berdasarkan informasi terbaru.`
        : `Topik: ${topic}.${notes ? ` Fokus: ${notes}.` : ""} ` +
          `Kumpulkan bahan riset berita terbaru tentang topik ini.`;

    let result;
    try {
      result = await callPerplexity({
        systemPrompt: mode === "draft" ? SYSTEM_DRAFT : SYSTEM_RESEARCH,
        userPrompt,
        recency: "month",
        domains: ID_OUTLETS,
        contextSize: "high",
        maxTokens: mode === "draft" ? 2200 : 1400,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Perplexity error";
      if (msg === "PERPLEXITY_NOT_CONFIGURED") {
        throw new ApiError(
          "API Key Perplexity belum dikonfigurasi. Tambahkan di Pengaturan → AI.",
          400,
        );
      }
      console.error("callPerplexity failed:", err);
      throw new ApiError(msg, 502);
    }

    // Strip any accidental code fence / wrapper the model may add.
    const html = result.text
      .replace(/^```(?:html)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(
      session.user.id,
      "AI_RESEARCH",
      "Article",
      "perplexity",
      JSON.stringify({ mode, topic, sources: result.sources.length }),
      ip,
    );

    return successResponse({
      content: html,
      sources: result.sources,
      related: result.related,
      provider: "perplexity",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
