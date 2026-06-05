import { NextRequest } from "next/server";
import { requireAuth, successResponse, errorResponse, ApiError, logAudit } from "@/lib/api-utils";
import { aiRateLimit } from "@/lib/rate-limit";
import { callAI, type AIFeature } from "@/lib/ai-client";
import { callPerplexity, isPerplexityConfigured, getPerplexityInstructions } from "@/lib/perplexity";
import { cleanAIShortText } from "@/lib/sanitize";

// System prompt for Perplexity when generating short article fields. Perplexity
// is web-grounded so it can check competitors/SEO, but it must return ONLY the
// requested value (no citation markers, no preamble).
const PPLX_SYSTEM =
  "Kamu editor SEO Kartawarta — media berita digital Bandung. Manfaatkan pencarian web untuk hasil " +
  "yang kompetitif di Google & Discover. Jawab LANGSUNG dengan nilai yang diminta saja — tanpa basa-basi, " +
  "tanpa penanda sitasi [1][2], tanpa markdown/code fence, tanpa daftar sumber. Bahasa Indonesia.";

/** Remove Perplexity citation markers like [1], [2][3] from generated text. */
function stripCitations(s: string): string {
  return s.replace(/\[\d+\]/g, "").replace(/ {2,}/g, " ").trim();
}

const PROMPTS: Record<string, (title: string, content: string) => string> = {
  tags: (title, content) =>
    `Berikan 5-8 tag relevan untuk artikel berita Kartawarta berikut (media berita digital Bandung — bisnis, ekonomi, pemerintahan, hukum, dan topik general lain). Format: tag1, tag2, tag3. Judul: ${title}. Konten: ${content.slice(0, 1000)}`,
  summary: (title, content) =>
    `Buatkan ringkasan 2-3 kalimat untuk artikel berita Kartawarta berikut. Judul: ${title}. Konten: ${content.slice(0, 2000)}`,
  seo_title: (title) =>
    `Buatkan SEO title (maks 60 karakter) untuk artikel berita Kartawarta berikut. Judul: ${title}`,
  meta_description: (title, content) =>
    `Buatkan meta description (maks 155 karakter) untuk artikel berita Kartawarta berikut. Judul: ${title}. Konten: ${content.slice(0, 1000)}`,
  content_ideas: (title) =>
    `bantu saya membuat beberapa ide artikel untuk kartawarta.com. terkait topik [[${title}]]. cek semua LSI relevan kompetitor dengan posisi terbaik di hasil pencarian google dan discover. Ide tidak hanya tentang angle lain yang belum tergarap kompetitor, tapi juga ikut berkompetisi untuk hasil maksimal di hasil pencarian dan discover. Pastikan data terbaru di 30 hari terakhir 2026. Format output sebagai list HTML (<ul> atau <ol>) yang terstruktur dengan sub-headings (<h2>/<h3>) dan penjelasan singkat per ide agar langsung siap dipakai di editor.`,
  write_article: (title, content) =>
    `buat draft artikel lengkap siap tayang  menjadi artikel ramah google discover dengan optimasi SEO, kombinasikan penggunaan LSI informasional dengan LSI transaksional yang relevan. gunakan tone kartawarta.com. cek kompetitor untuk hasil SEO lebih optimal. bebas kanibalisasi dengan artikel di kartawarta.com. Pastikan dari sumber kredibel dan autoritatif. Topik artikel: ${title}. ${content ? `Catatan/arahan tambahan: ${content}` : ""}. Format output sebagai HTML rich-text menggunakan tag <p> untuk paragraf, <h2>/<h3> untuk sub-headings, <blockquote> untuk kutipan penting, dan list (<ul>/<li>) untuk poin penting. Jangan sertakan tag <html>, <body>, atau markdown code fence.`,
  high_ctr_meta: (title, content) =>
    `Buat 5 variasi judul artikel berita dengan CTR tinggi (high CTR) dan 3 variasi meta deskripsi dengan CTR tinggi untuk kartawarta.com. Gaya bahasa harus ramah Google Discover, menarik rasa penasaran pembaca tanpa clickbait berlebihan. Topik/judul dasar: ${title}. ${content ? `Konten pendukung: ${content.slice(0, 1000)}` : ""}. Format output sebagai HTML terstruktur yang rapi dengan headings (<h2>/<h3>) dan paragraf agar mudah dibaca di dalam editor.`,
};

// Map request `feature` string to the canonical AIFeature used for logging.
const FEATURE_MAP: Record<string, AIFeature> = {
  tags: "bulk_tags",
  summary: "article_draft",
  seo_title: "seo_title",
  meta_description: "seo_description",
  content_ideas: "article_draft",
  write_article: "article_draft",
  high_ctr_meta: "article_draft",
};

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    // Rate limit per user
    const { success: allowed } = aiRateLimit(session.user.id);
    if (!allowed) {
      throw new ApiError("Batas penggunaan AI tercapai (20 request/jam). Coba lagi nanti.", 429);
    }

    const body = await req.json();
    const { feature, content, title } = body as {
      feature: string;
      content: string;
      title: string;
    };

    if (!feature || !content || !title) {
      throw new ApiError("Field feature, content, dan title diperlukan", 400);
    }

    if (!PROMPTS[feature]) {
      throw new ApiError("Feature tidak valid. Gunakan: tags, summary, seo_title, meta_description, content_ideas, write_article, high_ctr_meta", 400);
    }

    const prompt = PROMPTS[feature](title, content);
    const aiFeature = FEATURE_MAP[feature] ?? "article_draft";

    // Short fields must be clean plain text (no markdown/citations).
    const SHORT_FIELDS = new Set(["tags", "seo_title", "meta_description", "summary"]);
    const isShort = SHORT_FIELDS.has(feature);

    let resultText = "";
    let provider = "";
    let tokensUsed = 0;

    // Prefer Perplexity (web-grounded → checks competitors/SEO in real time) when
    // configured; fall back to Claude/DeepSeek so nothing breaks if it's unset/fails.
    const usePerplexity = await isPerplexityConfigured();
    if (usePerplexity) {
      try {
        const persona = await getPerplexityInstructions();
        const sys = persona ? `${PPLX_SYSTEM}\n\nARAHAN PENULIS: ${persona}` : PPLX_SYSTEM;
        const r = await callPerplexity({
          systemPrompt: sys,
          userPrompt: prompt,
          recency: "month",
          contextSize: isShort ? "low" : "medium",
          maxTokens: isShort ? 400 : 1600,
          temperature: 0.4,
          // Cost telemetry recorded inside callPerplexity (per stage → Combo
          // mode prices each model correctly instead of one fused row).
          usageMeta: {
            userId: session.user.id,
            userName: session.user.name || "user",
            feature: `perplexity_${aiFeature}`,
            articleTitle: title,
          },
        });
        resultText = stripCitations(r.text);
        provider = "perplexity";
        tokensUsed = r.usage.totalTokens;
      } catch (err) {
        console.error("Perplexity generate failed, falling back:", err);
      }
    }

    if (!resultText) {
      try {
        const result = await callAI({
          feature: aiFeature,
          userPrompt: prompt,
          maxTokens: 500,
          temperature: 0.7,
          userId: session.user.id,
          articleTitle: title,
        });
        resultText = result.text;
        provider = result.provider;
        tokensUsed = result.totalTokens;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI service error";
        console.error("callAI failed:", err);
        if (msg.includes("no API key configured") || msg.includes("providers exhausted")) {
          throw new ApiError("API Key AI belum dikonfigurasi atau tidak dapat dihubungi. Hubungi administrator.", 400);
        }
        throw new ApiError("Gagal menghubungi AI service. Coba lagi nanti.", 502);
      }
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "AI_GENERATE", "Article", "generate", JSON.stringify({ feature, tokensUsed, provider }), ip);

    // Clean short-field outputs so callers get plain text ready for HTML <meta> tags.
    const finalText = isShort ? cleanAIShortText(stripCitations(resultText)) : resultText;

    return successResponse({
      result: finalText,
      tokensUsed,
      provider,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
