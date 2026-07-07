/**
 * POST /api/ai/test-localai
 * Smoke-test the local/self-hosted AI server (OpenAI-compatible) with a tiny
 * prompt. Confirms the VPS can reach the configured base URL (e.g. the Mac mini
 * over Tailscale). Returns { success, message, durationMs, model }.
 *
 * Auth: SUPER_ADMIN
 */

import { errorResponse, requireRole, successResponse } from "@/lib/api-utils";
import { callLocalAI, getLocalAiConfig, isLocalAiReady } from "@/lib/local-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const cfg = await getLocalAiConfig();
    if (!isLocalAiReady(cfg)) {
      return successResponse({
        success: false,
        message: "Belum lengkap: aktifkan + isi Base URL & Model, lalu Simpan dulu.",
      });
    }

    const start = Date.now();
    try {
      const r = await callLocalAI({
        systemPrompt: "Jawab sangat singkat dalam Bahasa Indonesia.",
        userPrompt: "Balas dengan satu kalimat singkat untuk konfirmasi koneksi.",
        maxTokens: 60,
        temperature: 0.2,
      });
      const ms = Date.now() - start;
      const snippet = r.text.slice(0, 80);
      return successResponse({
        success: true,
        durationMs: ms,
        model: r.model,
        message: `Local AI OK (${ms}ms, model ${r.model}) — "${snippet}"`,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const message = /ECONNREFUSED|fetch failed|ENOTFOUND|timeout|abort/i.test(raw)
        ? `Tidak dapat menghubungi server (${cfg.baseUrl}). Pastikan Mac mini online, Tailscale aktif, dan VPS ada di tailnet yang sama. Detail: ${raw}`
        : raw;
      return successResponse({ success: false, message });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
