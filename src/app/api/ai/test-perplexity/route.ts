/**
 * POST /api/ai/test-perplexity
 * Smoke-test the Perplexity (Sonar) connection with a tiny query.
 * Returns { success, message, durationMs, sources } so the panel can confirm
 * the stored key works without writing an article.
 *
 * Auth: SUPER_ADMIN
 */

import { ApiError, errorResponse, requireRole, successResponse } from "@/lib/api-utils";
import { callPerplexity } from "@/lib/perplexity";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    if (!rateLimit(`ai-test-pplx:${session.user.id}`, 15, 60_000).success) {
      throw new ApiError("Terlalu banyak permintaan uji Perplexity. Coba lagi sebentar.", 429);
    }

    const start = Date.now();
    try {
      const result = await callPerplexity({
        systemPrompt: "Jawab sangat singkat dalam Bahasa Indonesia.",
        userPrompt: "Sebut satu berita terbaru dari Indonesia dalam satu kalimat singkat.",
        maxTokens: 80,
        recency: "week",
        contextSize: "low",
      });
      return successResponse({
        success: true,
        durationMs: Date.now() - start,
        sources: result.sources.length,
        message: `Perplexity OK (${Date.now() - start}ms, ${result.sources.length} sumber)`,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const message =
        raw === "PERPLEXITY_NOT_CONFIGURED"
          ? "API Key Perplexity belum diisi. Tempel key lalu Simpan dulu."
          : raw;
      return successResponse({ success: false, message });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
