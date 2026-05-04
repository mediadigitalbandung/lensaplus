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

export type GoogleIndexingType = "URL_UPDATED" | "URL_DELETED";

export interface GoogleIndexingResult {
  success: boolean;
  indexedAt?: Date;
  error?: string;
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

    return {
      success: true,
      indexedAt: new Date(),
      statusCode: response.status,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
