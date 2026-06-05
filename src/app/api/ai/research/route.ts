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
import { shouldOffloadSmallFields, deriveSmallFieldsViaDeepSeek } from "@/lib/ai-small-fields";
import { getPersonaInstruction } from "@/lib/perplexity-personas";
import { localizePerplexityImages } from "@/lib/perplexity-images";

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
    // Cap lengths — both feed the prompt; bound them so a huge payload can't
    // inflate token cost (the topic is also a title, the notes a focus blurb).
    const topic = (body.topic ?? "").toString().trim().slice(0, 500);
    const mode = body.mode === "research" ? "research" : "draft";
    const notes = (body.notes ?? "").toString().trim().slice(0, 2000);
    const personaKey = (body.persona ?? "").toString().trim();
    const includeImages = body.includeImages === true;
    // Freshness window for the web search. "all" (or anything invalid) → no
    // recency filter (search all time); default is the last month.
    const recencyRaw = (body.recency ?? "").toString().trim();
    const recency: "week" | "month" | "year" | undefined =
      recencyRaw === "week" || recencyRaw === "month" || recencyRaw === "year"
        ? recencyRaw
        : recencyRaw === "all"
          ? undefined
          : "month";
    if (!topic) throw new ApiError("Topik/judul wajib diisi", 400);

    const userPrompt =
      mode === "draft"
        ? `Topik artikel: ${topic}.${notes ? ` Arahan tambahan: ${notes}.` : ""} ` +
          `Hasilkan paket artikel lengkap PERSIS sesuai format penanda (===JUDUL===, ===RINGKASAN===, ===TAGS===, ===SEO_TITLE===, ===META===, ===KONTEN===) berdasarkan informasi terbaru. Jangan pakai JSON.`
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
        recency,
        domains: ID_OUTLETS,
        contextSize: "high",
        maxTokens: mode === "draft" ? 5000 : 1400,
        includeImages,
        // Centralised, per-stage cost telemetry (Combo mode logs 2 rows, each at
        // its own model). Replaces the manual recordAiUsage that mispriced combo.
        usageMeta: {
          userId: session.user.id,
          userName: session.user.name || "user",
          feature: mode === "draft" ? "perplexity_draft" : "perplexity_research",
          articleTitle: topic,
        },
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

    // Up to 3 web images (only when requested). DOWNLOAD them to /uploads so the
    // article doesn't hotlink external CDNs (licensing/expiry). `url` is local.
    const images = includeImages ? await localizePerplexityImages(result.images, 3) : [];

    // Cost telemetry is now recorded inside callPerplexity (per stage, via
    // usageMeta) so Combo mode prices each model correctly — see callPerplexity.

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(
      session.user.id,
      "AI_RESEARCH",
      "Article",
      "perplexity",
      JSON.stringify({ mode, topic, sources: result.sources.length, images: images.length, tokens: result.usage.totalTokens }),
      ip,
    );

    // Draft mode → parse the delimiter-block format (===JUDUL=== etc). This is
    // far more robust than JSON for a long HTML body (no quote/newline escaping
    // to break). Each section runs until the next ===MARKER=== or end of text.
    if (mode === "draft") {
      const section = (marker: string): string => {
        const re = new RegExp(
          `===${marker}===\\s*\\n?([\\s\\S]*?)(?=\\n?===(?:JUDUL|RINGKASAN|TAGS|SEO_TITLE|META|KONTEN)===|$)`,
          "i",
        );
        const m = cleaned.match(re);
        return m ? m[1].trim() : "";
      };

      const title = section("JUDUL");
      const content = section("KONTEN");
      const hasMarkers = /===KONTEN===/i.test(cleaned) || /===JUDUL===/i.test(cleaned);
      // If the model ignored the format, treat the whole reply as the body so
      // the user still gets the article (never lose the draft).
      const finalContent = content || (hasMarkers ? "" : cleaned);

      let excerpt = section("RINGKASAN");
      let tags = section("TAGS").replace(/^\[|\]$/g, "").replace(/"/g, "").trim();
      let seoTitle = section("SEO_TITLE");
      let metaDescription = section("META");

      // Cost combo: regenerate the small SEO metadata with cheap DeepSeek (opt-in,
      // and only when a DeepSeek key exists). Best-effort — keep Perplexity's on miss.
      if (finalContent && (await shouldOffloadSmallFields())) {
        const sf = await deriveSmallFieldsViaDeepSeek(title, finalContent, session.user.id);
        if (sf) {
          excerpt = sf.excerpt || excerpt;
          if (sf.tags.length) tags = sf.tags.join(", ");
          seoTitle = sf.seoTitle || seoTitle;
          metaDescription = sf.metaDescription || metaDescription;
        }
      }

      return successResponse({
        mode: "draft",
        fields: { title, excerpt, tags, seoTitle, metaDescription, content: finalContent },
        sources: result.sources,
        related: result.related,
        images,
        provider: "perplexity",
      });
    }

    // Research mode → HTML briefing, content only.
    return successResponse({
      mode: "research",
      content: cleaned,
      sources: result.sources,
      related: result.related,
      images,
      provider: "perplexity",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
