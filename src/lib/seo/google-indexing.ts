/**
 * Google Indexing API client.
 *
 * Reads a Google service-account JSON from `SystemSetting.google_credentials_json`
 * (falls back to env var `GOOGLE_CREDENTIALS_JSON`), authorizes with the
 * `indexing` scope, and publishes URL notifications to Google.
 *
 * Free quota is ~200 URLs/day. Caller is responsible for batching.
 *
 * Docs: https://developers.google.com/search/apis/indexing-api/v3/using-api
 */

import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

const INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";

const QUOTA_KEY = "google_indexing_daily_count";
const QUOTA_DATE_KEY = "google_indexing_daily_count_date";
export async function getQuotaLimit(): Promise<number> {
  try {
    const limitRow = await prisma.systemSetting.findUnique({
      where: { key: "google_indexing_quota_limit" },
    });
    if (limitRow?.value) {
      const parsed = parseInt(limitRow.value.trim(), 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {
    // DB unavailable
  }
  const envVal = process.env.GOOGLE_INDEXING_QUOTA_LIMIT;
  if (envVal) {
    const parsed = parseInt(envVal.trim(), 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 200; // default fallback
}

async function getDailyCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dateRow = await prisma.systemSetting.findUnique({ where: { key: QUOTA_DATE_KEY } });
  if (dateRow?.value !== today) {
    // Reset counter
    await prisma.systemSetting.upsert({
      where: { key: QUOTA_DATE_KEY },
      create: { key: QUOTA_DATE_KEY, value: today },
      update: { value: today },
    });
    await prisma.systemSetting.upsert({
      where: { key: QUOTA_KEY },
      create: { key: QUOTA_KEY, value: "0" },
      update: { value: "0" },
    });
    return 0;
  }
  const countRow = await prisma.systemSetting.findUnique({ where: { key: QUOTA_KEY } });
  return parseInt(countRow?.value || "0", 10);
}

async function incrementDailyCount(): Promise<void> {
  const current = await getDailyCount();
  await prisma.systemSetting.upsert({
    where: { key: QUOTA_KEY },
    create: { key: QUOTA_KEY, value: String(current + 1) },
    update: { value: String(current + 1) },
  });
}

async function saturateDailyCount(): Promise<void> {
  const limit = await getQuotaLimit();
  await prisma.systemSetting.upsert({
    where: { key: QUOTA_KEY },
    create: { key: QUOTA_KEY, value: String(limit) },
    update: { value: String(limit) },
  });
}

export type GoogleIndexingType = "URL_UPDATED" | "URL_DELETED";

export interface GoogleIndexingResult {
  success: boolean;
  indexedAt?: Date;
  error?: string;
  reason?: string;
  statusCode?: number;
}

interface ServiceAccountCredentials {
  type?: string;
  client_email?: string;
  private_key?: string;
}

/**
 * Read service-account JSON from SystemSetting or env var.
 * Returns null if none configured or if the feature toggle is disabled.
 */
async function getCredentials(): Promise<ServiceAccountCredentials | null> {
  let raw: string | null = null;

  try {
    const [cred, enabled] = await Promise.all([
      prisma.systemSetting.findUnique({
        where: { key: "google_credentials_json" },
      }),
      prisma.systemSetting.findUnique({
        where: { key: "google_indexing_enabled" },
      }),
    ]);
    // Treat missing toggle as enabled (opt-out), but explicit "false"/"0" disables.
    if (enabled?.value) {
      const v = enabled.value.trim().toLowerCase();
      if (v === "false" || v === "0" || v === "no" || v === "off") {
        return null;
      }
    }
    if (cred?.value && cred.value.trim().length > 0) {
      raw = decryptSecret(cred.value.trim());
    }
  } catch {
    // DB unavailable — fall through to env fallback.
  }

  if (!raw) {
    const envValue = process.env.GOOGLE_CREDENTIALS_JSON;
    if (envValue && envValue.trim().length > 0) {
      raw = envValue.trim();
    }
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ServiceAccountCredentials;
    if (parsed.type !== "service_account") return null;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Submit a single URL to the Google Indexing API.
 * Returns `{ success: false, error }` on missing credentials or API failure —
 * never throws.
 */
export async function submitUrlToGoogle(
  url: string,
  type: GoogleIndexingType = "URL_UPDATED",
): Promise<GoogleIndexingResult> {
  const credentials = await getCredentials();
  if (!credentials) {
    return {
      success: false,
      error:
        "Google Indexing not configured (missing google_credentials_json or disabled)",
    };
  }

  // Daily quota gate — Google's free quota is ~200/day (unless increased).
  // If we've already hit the limit, fail fast without burning an API call.
  const quotaLimit = await getQuotaLimit();
  try {
    const count = await getDailyCount();
    if (count >= quotaLimit) {
      return {
        success: false,
        error: "QUOTA_EXCEEDED_DAILY",
        reason: `Daily Google Indexing API quota (${quotaLimit}) reached`,
      };
    }
  } catch {
    // Quota check failed — fall through and try the API anyway.
  }

  try {
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [INDEXING_SCOPE],
    });

    const indexing = google.indexing({ version: "v3", auth });
    const response = await indexing.urlNotifications.publish({
      requestBody: { url, type },
    });

    // Record success in the daily counter (best-effort).
    try {
      await incrementDailyCount();
    } catch {
      /* swallow */
    }

    return {
      success: true,
      indexedAt: new Date(),
      statusCode: response.status,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If Google rejects with quota-exceeded, saturate our local counter so
    // subsequent calls within the same day fail fast.
    if (
      msg.includes("Quota exceeded") ||
      msg.includes("429") ||
      msg.toLowerCase().includes("rate limit")
    ) {
      try {
        await saturateDailyCount();
      } catch {
        /* swallow */
      }
    }
    return { success: false, error: msg };
  }
}

/**
 * Validate service-account credentials by fetching an access token.
 * Used by `/api/seo/test-credentials`.
 */
export async function testGoogleCredentials(): Promise<GoogleIndexingResult> {
  const credentials = await getCredentials();
  if (!credentials) {
    return {
      success: false,
      error:
        "No credentials configured. Set SystemSetting 'google_credentials_json' with service-account JSON.",
    };
  }

  try {
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [INDEXING_SCOPE],
    });
    const token = await auth.authorize();
    if (!token.access_token) {
      return { success: false, error: "Authorization returned no access_token" };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
