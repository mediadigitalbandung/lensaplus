import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, successResponse, errorResponse, ApiError, logAudit } from "@/lib/api-utils";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";
import { callAI, type AIFeature } from "@/lib/ai-client";
import { callPerplexity, isPerplexityConfigured, getPerplexityInstructions } from "@/lib/perplexity";
import { callLocalAI, getLocalAiConfig, isLocalAiReady } from "@/lib/local-ai";
import { cleanAIShortText } from "@/lib/sanitize";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/security";

// System prompt for Perplexity when generating short article fields. Perplexity
// is web-grounded so it can check competitors/SEO, but it must return ONLY the
// requested value (no citation markers, no preamble).
const PPLX_SYSTEM =
  "Kamu editor SEO Lensaplus — media berita digital nasional Indonesia. Manfaatkan pencarian web untuk hasil " +
  "yang kompetitif di Google & Discover. Jawab LANGSUNG dengan nilai yang diminta saja — tanpa basa-basi, " +
  "tanpa penanda sitasi [1][2], tanpa markdown/code fence, tanpa daftar sumber. Bahasa Indonesia.";

// System prompt for the local/self-hosted model (no web access — pure writing).
const LOCAL_SYSTEM =
  "Kamu editor Lensaplus — media berita digital nasional Indonesia. Tulis dalam Bahasa Indonesia yang faktual, " +
  "jelas, dan SEO-friendly. Jawab LANGSUNG dengan nilai yang diminta saja — tanpa basa-basi, tanpa " +
  "penanda sitasi, tanpa markdown/code fence.";

/** Remove Perplexity citation markers like [1], [2][3] from generated text. */
function stripCitations(s: string): string {
  return s.replace(/\[\d+\]/g, "").replace(/ {2,}/g, " ").trim();
}

const PROMPTS: Record<string, (title: string, content: string) => string> = {
  tags: (title, content) =>
    `Berikan 5-8 tag relevan untuk artikel berita Lensaplus berikut (media berita digital nasional Indonesia — bisnis, ekonomi, pemerintahan, hukum, dan topik general lain). Format: tag1, tag2, tag3. Judul: ${title.slice(0, 300)}. Konten: ${content.slice(0, 1000)}`,
  summary: (title, content) =>
    `Buatkan ringkasan 2-3 kalimat untuk artikel berita Lensaplus berikut. Judul: ${title.slice(0, 300)}. Konten: ${content.slice(0, 2000)}`,
  seo_title: (title) =>
    `Buatkan SEO title (maks 60 karakter) untuk artikel berita Lensaplus berikut. Judul: ${title.slice(0, 300)}`,
  meta_description: (title, content) =>
    `Buatkan meta description (maks 155 karakter) untuk artikel berita Lensaplus berikut. Judul: ${title.slice(0, 300)}. Konten: ${content.slice(0, 1000)}`,
  content_ideas: (title, content) =>
    `bantu saya membuat beberapa ide artikel untuk lensaplus.com. terkait topik [[${title.slice(0, 300)}]]. ${content ? `Catatan tambahan: ${content.slice(0, 1500)}. ` : ""}cek semua LSI relevan kompetitor dengan posisi terbaik di hasil pencarian google dan discover. Ide tidak hanya tentang angle lain yang belum tergarap kompetitor, tapi juga ikut berkompetisi untuk hasil maksimal di hasil pencarian dan discover. Pastikan data terbaru di 30 hari terakhir 2026. Format output sebagai list HTML (<ul> atau <ol>) yang terstruktur dengan sub-headings (<h2>/<h3>) dan penjelasan singkat per ide agar langsung siap dipakai di editor.`,
  write_article: (title, content) =>
    `buat draft artikel lengkap siap tayang  menjadi artikel ramah google discover dengan optimasi SEO, kombinasikan penggunaan LSI informasional dengan LSI transaksional yang relevan. gunakan tone lensaplus.com. cek kompetitor untuk hasil SEO lebih optimal. bebas kanibalisasi dengan artikel di lensaplus.com. Pastikan dari sumber kredibel dan autoritatif. Topik artikel: ${title.slice(0, 300)}. ${content ? `Catatan/arahan tambahan: ${content.slice(0, 3000)}` : ""}. Format output sebagai HTML rich-text menggunakan tag <p> untuk paragraf, <h2>/<h3> untuk sub-headings, <blockquote> untuk kutipan penting, dan list (<ul>/<li>) untuk poin penting. Jangan sertakan tag <html>, <body>, atau markdown code fence.`,
  high_ctr_meta: (title, content) =>
    `Buat 5 variasi judul artikel berita dengan CTR tinggi (high CTR) dan 3 variasi meta deskripsi dengan CTR tinggi untuk lensaplus.com. Gaya bahasa harus ramah Google Discover, menarik rasa penasaran pembaca tanpa clickbait berlebihan. Topik/judul dasar: ${title.slice(0, 300)}. ${content ? `Konten pendukung: ${content.slice(0, 1000)}` : ""}. Format output sebagai HTML terstruktur yang rapi dengan headings (<h2>/<h3>) dan paragraf agar mudah dibaca di dalam editor.`,
  expand_article: (title, content) =>
    `Artikel berita Lensaplus berikut masih terlalu pendek (di bawah batas minimal 300 kata). Tugas Anda adalah menulis lanjutan/perluasan sebanyak 2 hingga 4 paragraf tambahan (sekitar 180–260 kata) yang memperdalam konteks, latar belakang topik, analisis dampak, serta relevansi bagi pembaca secara informatif, objektif, dan jurnalistik (PUEBI).\n\nATURAN KETAT:\n- JANGAN mengulang kalimat yang sudah ada di artikel.\n- JANGAN mengarang kutipan langsung atau angka statistik fiktif yang tidak ada di artikel.\n- Gunakan sub-judul <h2> yang relevan diikuti paragraf <p>...</p> yang mengalir alami menyambung artikel.\n- Keluarkan HANYA fragmen HTML tambahan (<h2> dan <p>) tanpa pembungkus <html>, <body>, markdown code fence, atau catatan pembuka.\n\nJudul Artikel: ${title.slice(0, 300)}\nIsi Artikel Saat Ini:\n${content.slice(0, 4000)}`,
};

const CREATION_FEATURES = new Set(["content_ideas", "write_article", "high_ctr_meta"]);

const generateSchema = z.object({
  feature: z.enum([
    "tags",
    "summary",
    "seo_title",
    "meta_description",
    "content_ideas",
    "write_article",
    "high_ctr_meta",
    "expand_article",
  ]),
  title: z.string().max(500).optional().default(""),
  topic: z.string().max(300).optional().default(""),
  instruction: z.string().max(2000).optional().default(""),
  content: z.string().max(15000).optional().default(""),
});

// Map request `feature` string to the canonical AIFeature used for logging.
const FEATURE_MAP: Record<string, AIFeature> = {
  tags: "bulk_tags",
  summary: "article_draft",
  seo_title: "seo_title",
  meta_description: "seo_description",
  content_ideas: "article_draft",
  write_article: "article_draft",
  high_ctr_meta: "article_draft",
  expand_article: "article_draft",
};

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    // Rate limit per user
    const { success: allowed } = aiRateLimit(session.user.id);
    if (!allowed) {
      throw new ApiError("Batas penggunaan AI tercapai (20 request/jam). Coba lagi nanti.", 429);
    }

    const rawBody = await readJsonBody(req);
    const parsed = generateSchema.parse(rawBody);
    const { feature } = parsed;
    const effectiveTitle = (parsed.title || parsed.topic || parsed.instruction).trim().slice(0, 300);
    const effectiveContent = (parsed.content || parsed.instruction).trim().slice(0, 15000);

    if (CREATION_FEATURES.has(feature)) {
      if (!effectiveTitle) {
        throw new ApiError("Topik, judul, atau arahan diperlukan", 400);
      }
    } else if (!effectiveTitle || !effectiveContent) {
      throw new ApiError("Field feature, content, dan title diperlukan", 400);
    }

    const title = effectiveTitle;
    const content = effectiveContent;
    const prompt = PROMPTS[feature](title, content);
    const aiFeature = FEATURE_MAP[feature] ?? "article_draft";

    // Short fields must be clean plain text (no markdown/citations).
    const SHORT_FIELDS = new Set(["tags", "seo_title", "meta_description", "summary"]);
    const isShort = SHORT_FIELDS.has(feature);

    let resultText = "";
    let provider = "";
    let tokensUsed = 0;

    const actorName = session.user.name || session.user.email || "user";
    const editorPrefRow = await prisma.systemSetting
      .findUnique({ where: { key: "ai_editor_provider" } })
      .catch(() => null);
    const editorPref = (editorPrefRow?.value ?? "").trim();

    async function tryForcedCallAI(forced: "deepseek" | "anthropic"): Promise<boolean> {
      try {
        const r = await callAI({
          feature: aiFeature,
          forceProvider: forced,
          userPrompt: prompt,
          maxTokens: isShort ? 500 : 2000,
          temperature: isShort ? 0.5 : 0.7,
          userId: session.user.id,
          userName: actorName,
          articleTitle: title,
          allowCombo: !isShort,
        });
        resultText = r.text;
        provider = r.provider;
        tokensUsed = r.totalTokens;
        return true;
      } catch (err) {
        console.error(`Forced ${forced} generate failed, falling back:`, err);
        return false;
      }
    }

    if (editorPref === "deepseek" || editorPref === "anthropic") {
      await tryForcedCallAI(editorPref);
    }

    // Local / self-hosted AI (OpenAI-compatible) as an EXTRA drafting engine.
    const localai = await getLocalAiConfig();
    async function tryLocalAI(): Promise<void> {
      if (resultText || !isLocalAiReady(localai)) return;
      try {
        const persona = localai.instructions
          ? ""
          : await getPerplexityInstructions(); // fallback shared editor persona
        const sys = persona ? `${LOCAL_SYSTEM}\n\nARAHAN PENULIS: ${persona}` : LOCAL_SYSTEM;
        const r = await callLocalAI({
          systemPrompt: sys,
          userPrompt: prompt,
          maxTokens: isShort ? 400 : 1600,
          temperature: 0.4,
          usageMeta: {
            userId: session.user.id,
            userName: actorName,
            feature: `local_${aiFeature}`,
            articleTitle: title,
          },
        });
        resultText = stripCitations(r.text);
        provider = "local";
        tokensUsed = r.usage.totalTokens;
      } catch (err) {
        console.error("Local AI generate failed:", err);
      }
    }

    // If preferred, Local AI goes first (before Perplexity).
    if (!resultText && localai.prefer) await tryLocalAI();

    // Perplexity (web-grounded) when configured; fall back to Local AI, then
    // Claude/DeepSeek so nothing breaks if an engine is unset/fails.
    const usePerplexity = !resultText && (await isPerplexityConfigured());
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
            userName: actorName,
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

    // Local AI as fallback (enabled but not preferred) before Claude/DeepSeek.
    if (!resultText && !localai.prefer) await tryLocalAI();

    if (!resultText) {
      try {
        const result = await callAI({
          feature: aiFeature,
          userPrompt: prompt,
          maxTokens: isShort ? 500 : 2000,
          temperature: isShort ? 0.5 : 0.7,
          userId: session.user.id,
          userName: actorName,
          articleTitle: title,
          allowCombo: !isShort,
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
        if (msg.includes("dinonaktifkan")) {
          throw new ApiError(msg, 400);
        }
        throw new ApiError("Gagal menghubungi AI service. Coba lagi nanti.", 502);
      }
    }

    const ip = getClientIp(req);
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
