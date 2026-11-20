import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole, successResponse, errorResponse, logAudit, ApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";
import {
  encryptSecret,
  decryptSecret,
  isSensitiveKey,
  maskSecret,
} from "@/lib/crypto-secrets";

// All keys that the panel is allowed to write. Anything outside this list
// is rejected by the Zod enum below — prevents arbitrary key insertion that
// could shadow internal flags (e.g. `auto_article_last_run_at`,
// `sorotan_last_run_at`) and corrupt cron state.
const ALLOWED_KEYS = [
  // Branding
  "site_name",
  "site_description",
  "contact_email",
  // Email
  "resend_api_key",
  "notification_email_from",
  // Feature toggles
  "enable_comments",
  "enable_ai",
  "maintenance_mode",
  // AI routing
  "ai_primary_provider",
  "ai_editor_provider",
  // AI providers — Anthropic (Claude)
  "anthropic_api_key",
  "anthropic_instructions",
  "anthropic_model",
  "anthropic_max_tokens",
  "anthropic_temperature",
  // AI providers — DeepSeek
  "deepseek_api_key",
  "deepseek_instructions",
  "deepseek_model",
  "deepseek_max_tokens",
  "deepseek_temperature",
  "deepseek_top_p",
  "deepseek_frequency_penalty",
  "deepseek_combo_enabled",
  "deepseek_research_model",
  // Local / self-hosted AI (OpenAI-compatible, e.g. Ollama/LM Studio on a Mac
  // mini over Tailscale) — extra drafting engine alongside Perplexity.
  "localai_enabled",
  "localai_base_url",
  "localai_model",
  "localai_api_key",
  "localai_prefer",
  "localai_instructions",
  "localai_max_tokens",
  "localai_temperature",
  // Perplexity (Sonar) — web-grounded research + sourced article drafting
  "perplexity_api_key",
  "perplexity_instructions",
  // Perplexity cost controls (token-saving)
  "perplexity_model",
  "perplexity_max_tokens",
  "perplexity_search_context",
  // Perplexity Combo mode (2-stage: research model → cheap draft model)
  "perplexity_combo_enabled",
  "perplexity_research_model",
  // Offload small SEO fields (excerpt/tags/seo title/meta) to cheap DeepSeek
  "perplexity_small_fields_deepseek",
  // USD→IDR rate for the AI cost dashboard (Statistik → AI). Default 16500.
  "usd_idr_rate",
  // Reel voiceover (TTS): Gemini (AI Studio) + ElevenLabs, with a provider switch
  "gemini_api_key",
  "gemini_tts_model",
  "gemini_tts_voice",
  "elevenlabs_api_key",
  "elevenlabs_voice_id",
  "elevenlabs_model",
  "tts_provider",
  // Google Indexing / GSC / GA
  "google_credentials_json",
  "google_indexing_enabled",
  "gsc_site_url",
  "ga4_property_id",
  // GA4 Measurement ID (G-XXXXXXX) for the on-site gtag tracking tag. Public,
  // non-secret value — injected into every public page so GA actually collects
  // pageviews/users. Distinct from ga4_property_id (the Data-API read side).
  "ga4_measurement_id",
  // Cloudflare
  "cloudflare_api_token",
  "cloudflare_zone_id",
  // Twitter / X
  "twitter_consumer_key",
  "twitter_consumer_secret",
  "twitter_access_token",
  "twitter_access_secret",
  "twitter_bearer_token",
  // Auto-article cron knobs (auto_article_author_id configures the draft author)
  "auto_article_enabled",
  "auto_article_interval_minutes",
  "auto_article_batch_size",
  "auto_article_author_id",
  // Deprecated keys kept so existing DB rows remain readable via GET,
  // but the UI no longer writes them (uses batch_size/interval_minutes).
  "auto_article_count",
  "auto_article_interval",
  // Sorotan cron knobs
  "sorotan_auto_enabled",
  "sorotan_interval_minutes",
  "sorotan_batch_size",
  // IndexNow
  "indexnow_enabled",
  "indexnow_key",
  // Press membership card (KTA) — org officials & signatures (not secrets)
  "kta_director_name",
  "kta_director_signature",
  "kta_pwi_chairman_name",
  "kta_pwi_chairman_signature",
  "kta_card_logo",
  "kta_dewan_pers_logo",
  "kta_dewan_pers_number",
  "kta_issue_place",
  // YouTube auto-clipper (Deepgram STT). The worker reads DEEPGRAM_API_KEY from
  // env; this stored key powers the in-app /api/youtube/test smoke test.
  "deepgram_api_key",
  "youtube_clip_enabled",
] as const;

const settingSchema = z.object({
  key: z.enum(ALLOWED_KEYS, {
    errorMap: () => ({ message: "Setting key tidak diizinkan." }),
  }),
  value: z.string().max(20000),
});

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const settings = await prisma.systemSetting.findMany();
    const keyValue: Record<string, string> = {};
    for (const s of settings) {
      if (isSensitiveKey(s.key)) {
        // Decrypt first, then return masked value so the panel can confirm
        // "which key is stored" without exposing the credential.
        try {
          const plaintext = decryptSecret(s.value);
          keyValue[s.key] = plaintext ? maskSecret(plaintext) : "";
        } catch {
          // If decrypt fails (e.g. corrupted), return a fixed mask.
          keyValue[s.key] = "••••••••????";
        }
      } else {
        keyValue[s.key] = s.value;
      }
    }

    return successResponse(keyValue);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);

    const body = await req.json();
    const data = settingSchema.parse(body);

    const sensitive = isSensitiveKey(data.key);
    const trimmedVal = data.value.trim();
    if (sensitive && (trimmedVal.startsWith("••••••••") || trimmedVal === "(tidak berubah)")) {
      const existing = await prisma.systemSetting.findUnique({ where: { key: data.key } });
      if (!existing) {
        throw new ApiError("Masukkan nilai kunci asli (bukan nilai termasking).", 400);
      }
      // Preserve existing secret in DB without overwriting it with a masked placeholder
      return successResponse({ key: data.key, value: data.value });
    }

    // Encrypt sensitive values before persisting.
    const storedValue = sensitive
      ? encryptSecret(data.value)
      : data.value;

    await prisma.systemSetting.upsert({
      where: { key: data.key },
      update: { value: storedValue },
      create: { key: data.key, value: storedValue },
    });

    // When rotating/updating the Google service account JSON, reset the daily
    // quota counter so a new Google Cloud project starts fresh at 0/day instead
    // of inheriting a saturated 200/200 count from the previous project.
    if (data.key === "google_credentials_json") {
      const today = new Date().toISOString().slice(0, 10);
      await Promise.all([
        prisma.systemSetting.upsert({
          where: { key: "google_indexing_daily_count_date" },
          update: { value: today },
          create: { key: "google_indexing_daily_count_date", value: today },
        }),
        prisma.systemSetting.upsert({
          where: { key: "google_indexing_daily_count" },
          update: { value: "0" },
          create: { key: "google_indexing_daily_count", value: "0" },
        }),
      ]).catch(() => {});
    }

    // Never return the plaintext back to the client.
    const responseValue = sensitive
      ? (data.value ? maskSecret(data.value) : "")
      : data.value;

    const ip = getClientIp(req);
    await logAudit(session.user.id, "SETTING_UPDATE", "SystemSetting", data.key, JSON.stringify({ key: data.key }), ip);

    return successResponse({ key: data.key, value: responseValue });
  } catch (error) {
    return errorResponse(error);
  }
}
