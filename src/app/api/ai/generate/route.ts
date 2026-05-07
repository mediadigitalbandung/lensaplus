import { NextRequest } from "next/server";
import { requireAuth, successResponse, errorResponse, ApiError, logAudit } from "@/lib/api-utils";
import { aiRateLimit } from "@/lib/rate-limit";
import { callAI, type AIFeature } from "@/lib/ai-client";

const PROMPTS: Record<string, (title: string, content: string) => string> = {
  tags: (title, content) =>
    `Berikan 5-8 tag relevan untuk artikel berita hukum berikut. Format: tag1, tag2, tag3. Judul: ${title}. Konten: ${content.slice(0, 1000)}`,
  summary: (title, content) =>
    `Buatkan ringkasan 2-3 kalimat untuk artikel berita hukum berikut. Judul: ${title}. Konten: ${content.slice(0, 2000)}`,
  seo_title: (title) =>
    `Buatkan SEO title (maks 60 karakter) untuk artikel berita hukum berikut. Judul: ${title}`,
  meta_description: (title, content) =>
    `Buatkan meta description (maks 155 karakter) untuk artikel berita hukum berikut. Judul: ${title}. Konten: ${content.slice(0, 1000)}`,
};

// Map request `feature` string to the canonical AIFeature used for logging.
const FEATURE_MAP: Record<string, AIFeature> = {
  tags: "bulk_tags",
  summary: "article_draft",
  seo_title: "seo_title",
  meta_description: "seo_description",
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
      throw new ApiError("Feature tidak valid. Gunakan: tags, summary, seo_title, meta_description", 400);
    }

    const prompt = PROMPTS[feature](title, content);
    const aiFeature = FEATURE_MAP[feature] ?? "article_draft";

    let result;
    try {
      result = await callAI({
        feature: aiFeature,
        userPrompt: prompt,
        maxTokens: 500,
        temperature: 0.7,
        userId: session.user.id,
        articleTitle: title,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI service error";
      // Surface a user-friendly message but preserve cause in logs
      console.error("callAI failed:", err);
      if (msg.includes("no API key configured") || msg.includes("providers exhausted")) {
        throw new ApiError("API Key AI belum dikonfigurasi atau tidak dapat dihubungi. Hubungi administrator.", 400);
      }
      throw new ApiError("Gagal menghubungi AI service. Coba lagi nanti.", 502);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "AI_GENERATE", "Article", "generate", JSON.stringify({ feature, tokensUsed: result.totalTokens, provider: result.provider }), ip);

    return successResponse({
      result: result.text,
      tokensUsed: result.totalTokens,
      provider: result.provider,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
