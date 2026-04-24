/**
 * Cloudflare cache purge via API v4.
 * Reads API token + zone ID from SystemSetting (env fallback).
 * Non-blocking, graceful failure when not configured.
 */

import { prisma } from "../prisma";

const CF_API = "https://api.cloudflare.com/client/v4";

async function getCredentials(): Promise<{ token: string; zoneId: string } | null> {
  const [tokenRow, zoneRow] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: "cloudflare_api_token" } }).catch(() => null),
    prisma.systemSetting.findUnique({ where: { key: "cloudflare_zone_id" } }).catch(() => null),
  ]);
  const token = tokenRow?.value || process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = zoneRow?.value || process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) return null;
  return { token, zoneId };
}

export interface PurgeResult {
  success: boolean;
  purgedCount: number;
  error?: string;
}

/**
 * Purge specific URLs from Cloudflare cache.
 * @param urls Array of absolute URLs (must include https://)
 */
export async function purgeCache(urls: string[]): Promise<PurgeResult> {
  if (!urls.length) return { success: true, purgedCount: 0 };

  const creds = await getCredentials();
  if (!creds) {
    return { success: false, purgedCount: 0, error: "Cloudflare not configured (missing cloudflare_api_token or cloudflare_zone_id)" };
  }

  // Validate URLs must be absolute
  const validUrls = urls.filter((u) => /^https?:\/\//.test(u));
  if (validUrls.length === 0) {
    return { success: false, purgedCount: 0, error: "No valid absolute URLs provided" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${CF_API}/zones/${creds.zoneId}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: validUrls }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      errors?: Array<{ message: string }>;
    } | null;

    if (!json?.success) {
      const errMsg = json?.errors?.[0]?.message || `HTTP ${res.status}`;
      return { success: false, purgedCount: 0, error: errMsg };
    }

    return { success: true, purgedCount: validUrls.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, purgedCount: 0, error };
  }
}

/**
 * Purge ALL cache in the zone. DANGEROUS — use sparingly (emergency only).
 */
export async function purgeEverything(): Promise<PurgeResult> {
  const creds = await getCredentials();
  if (!creds) {
    return { success: false, purgedCount: 0, error: "Cloudflare not configured" };
  }

  try {
    const res = await fetch(`${CF_API}/zones/${creds.zoneId}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ purge_everything: true }),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; errors?: Array<{ message: string }> } | null;
    if (!json?.success) {
      return { success: false, purgedCount: 0, error: json?.errors?.[0]?.message || `HTTP ${res.status}` };
    }
    return { success: true, purgedCount: -1 };
  } catch (e) {
    return { success: false, purgedCount: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Convenience: purge URLs related to an article publication event.
 */
export async function purgeArticleCache(slug: string, categorySlug?: string): Promise<PurgeResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  const urls = [
    `${baseUrl}/`,
    `${baseUrl}/berita/${slug}`,
    `${baseUrl}/berita`,
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap-news.xml`,
  ];
  if (categorySlug) {
    urls.push(`${baseUrl}/kategori/${categorySlug}`);
  }
  return purgeCache(urls);
}
