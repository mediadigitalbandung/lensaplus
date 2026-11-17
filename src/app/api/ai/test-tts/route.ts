/**
 * POST /api/ai/test-tts
 * Connectivity smoke test for Reel TTS providers (Gemini AI Studio / ElevenLabs)
 * without spending synthesis quota.
 *
 * Body: { provider: "gemini" | "elevenlabs" }
 * Auth: SUPER_ADMIN
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, requireRole, successResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  provider: z.enum(["gemini", "elevenlabs"]),
});

async function readStoredKey(settingKey: string, envFallbacks: string[]): Promise<string | null> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: settingKey } });
    if (row?.value?.trim()) {
      try {
        return decryptSecret(row.value.trim());
      } catch {
        return row.value.trim();
      }
    }
  } catch {
    /* fall through */
  }
  for (const envName of envFallbacks) {
    const v = process.env[envName];
    if (v?.trim()) return v.trim();
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const raw = await req.json().catch(() => ({}));
    const { provider } = schema.parse(raw || {});

    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      if (provider === "gemini") {
        const key = await readStoredKey("gemini_api_key", ["GEMINI_API_KEY", "GOOGLE_AISTUDIO_KEY"]);
        if (!key) {
          return successResponse({
            success: false,
            message: "Gemini API Key belum diisi. Simpan key terlebih dahulu.",
          });
        }
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
          headers: { "x-goog-api-key": key },
          signal: controller.signal,
        });
        if (!res.ok) {
          const detail = (await res.text().catch(() => "")).slice(0, 200);
          return successResponse({
            success: false,
            message: `Gemini HTTP ${res.status}: ${detail || "Koneksi gagal"}`,
          });
        }
        return successResponse({
          success: true,
          durationMs: Date.now() - start,
          message: `Gemini OK (${Date.now() - start}ms)`,
        });
      }

      const key = await readStoredKey("elevenlabs_api_key", ["ELEVENLABS_API_KEY"]);
      if (!key) {
        return successResponse({
          success: false,
          message: "ElevenLabs API Key belum diisi. Simpan key terlebih dahulu.",
        });
      }
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": key },
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 200);
        return successResponse({
          success: false,
          message: `ElevenLabs HTTP ${res.status}: ${detail || "Koneksi gagal"}`,
        });
      }
      const info = (await res.json().catch(() => null)) as {
        subscription?: { character_count?: number; character_limit?: number };
      } | null;
      const used = info?.subscription?.character_count;
      const limit = info?.subscription?.character_limit;
      const quotaNote =
        typeof used === "number" && typeof limit === "number"
          ? `, kuota ${Math.max(0, limit - used).toLocaleString("id-ID")} karakter tersisa`
          : "";
      return successResponse({
        success: true,
        durationMs: Date.now() - start,
        message: `ElevenLabs OK (${Date.now() - start}ms${quotaNote})`,
      });
    } catch (err) {
      return successResponse({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return errorResponse(err);
  }
}
