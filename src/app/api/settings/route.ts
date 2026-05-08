import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole, successResponse, errorResponse, logAudit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
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
  // AI providers
  "deepseek_api_key",
  "anthropic_api_key",
  // Google Indexing / GSC / GA
  "google_credentials_json",
  "google_indexing_enabled",
  "gsc_site_url",
  "ga4_property_id",
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
  "indexnow_key",
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
          keyValue[s.key] = maskSecret(plaintext);
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

    // Encrypt sensitive values before persisting.
    const storedValue = isSensitiveKey(data.key)
      ? encryptSecret(data.value)
      : data.value;

    await prisma.systemSetting.upsert({
      where: { key: data.key },
      update: { value: storedValue },
      create: { key: data.key, value: storedValue },
    });

    // Never return the plaintext back to the client.
    const responseValue = isSensitiveKey(data.key)
      ? maskSecret(data.value)
      : data.value;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "SETTING_UPDATE", "SystemSetting", data.key, JSON.stringify({ key: data.key }), ip);

    return successResponse({ key: data.key, value: responseValue });
  } catch (error) {
    return errorResponse(error);
  }
}
