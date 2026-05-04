import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole, successResponse, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

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
  // Auto-article cron knobs
  "auto_article_enabled",
  "auto_article_interval_minutes",
  "auto_article_batch_size",
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
      keyValue[s.key] = s.value;
    }

    return successResponse(keyValue);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const body = await req.json();
    const data = settingSchema.parse(body);

    await prisma.systemSetting.upsert({
      where: { key: data.key },
      update: { value: data.value },
      create: { key: data.key, value: data.value },
    });

    return successResponse({ key: data.key, value: data.value });
  } catch (error) {
    return errorResponse(error);
  }
}
