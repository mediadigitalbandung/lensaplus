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
import { callPerplexity, getPerplexityInstructions } from "@/lib/perplexity";
import { getPersonaInstruction } from "@/lib/perplexity-personas";

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
  "kredibel dan TERBARU, lalu hasilkan PAKET artikel lengkap berbahasa Indonesia yang faktual " +
  "dan SEO-friendly. JANGAN mengarang fakta — hanya yang didukung sumber. " +
  "Jawab HANYA dengan JSON valid (tanpa markdown, tanpa code fence, tanpa teks lain), objek dengan field: " +
  '{"title": judul artikel menarik (maks 110 kar), ' +
  '"excerpt": ringkasan 1-2 kalimat (maks 200 kar), ' +
  '"tags": array 5-8 tag relevan (string), ' +
  '"seoTitle": judul SEO (maks 60 kar), ' +
  '"metaDescription": meta description (maks 155 kar), ' +
  '"contentHtml": isi artikel sebagai HTML rich-text — <p> untuk paragraf, <h2>/<h3> sub-judul, ' +
  "<blockquote> kutipan, <ul>/<li> poin; tanpa tag <html>/<body>, tanpa daftar sumber di akhir}. " +
  "Jangan sertakan penanda sitasi [1][2] di dalam nilai teks apa pun.";

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
    const personaKey = (body.persona ?? "").toString().trim();
    if (!topic) throw new ApiError("Topik/judul wajib diisi", 400);

    const userPrompt =
      mode === "draft"
        ? `Topik artikel: ${topic}.${notes ? ` Arahan tambahan: ${notes}.` : ""} ` +
          `Hasilkan paket artikel lengkap (JSON sesuai instruksi) berdasarkan informasi terbaru.`
        : `Topik: ${topic}.${notes ? ` Fokus: ${notes}.` : ""} ` +
          `Kumpulkan bahan riset berita terbaru tentang topik ini.`;

    // Layer the system prompt: base + selected preset persona + the editor's
    // custom global instructions (Settings → AI). Both are optional.
    const customInstructions = await getPerplexityInstructions();
    const personaInstruction = getPersonaInstruction(personaKey);
    const baseSystem = mode === "draft" ? SYSTEM_DRAFT : SYSTEM_RESEARCH;
    let systemPrompt = baseSystem;
    if (personaInstruction) systemPrompt += `\n\nGAYA PENULISAN: ${personaInstruction}`;
    if (customInstructions) systemPrompt += `\n\nARAHAN PENULIS (WAJIB DIIKUTI): ${customInstructions}`;

    let result;
    try {
      result = await callPerplexity({
        systemPrompt,
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

    // Strip citation markers + any accidental code fence wrapper.
    const cleaned = result.text
      .replace(/\[\d+\]/g, "")
      .replace(/^```(?:json|html)?\s*/i, "")
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

    // Draft mode → parse the structured JSON package so the panel can fill every
    // field. If parsing fails, fall back to treating the whole text as content.
    if (mode === "draft") {
      let pkg: Record<string, unknown> | null = null;
      try {
        pkg = JSON.parse(cleaned);
      } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            pkg = JSON.parse(m[0]);
          } catch {
            pkg = null;
          }
        }
      }
      if (pkg && typeof pkg === "object") {
        const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
        const tagsVal = Array.isArray(pkg.tags)
          ? (pkg.tags as unknown[]).map((t) => str(t)).filter(Boolean).join(", ")
          : str(pkg.tags);
        return successResponse({
          mode: "draft",
          fields: {
            title: str(pkg.title),
            excerpt: str(pkg.excerpt),
            tags: tagsVal,
            seoTitle: str(pkg.seoTitle),
            metaDescription: str(pkg.metaDescription),
            content: str(pkg.contentHtml) || str(pkg.content),
          },
          sources: result.sources,
          related: result.related,
          provider: "perplexity",
        });
      }
      // Fallback: not valid JSON — return as raw content only.
      return successResponse({
        mode: "draft",
        fields: { content: cleaned },
        sources: result.sources,
        related: result.related,
        provider: "perplexity",
      });
    }

    // Research mode → HTML briefing, content only.
    return successResponse({
      mode: "research",
      content: cleaned,
      sources: result.sources,
      related: result.related,
      provider: "perplexity",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
