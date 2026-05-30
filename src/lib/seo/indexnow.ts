/**
 * IndexNow ping — notifies Bing, Yandex, Seznam, Naver, etc. when URLs change.
 *
 * Key is read from `public/indexnow-key.txt` (file must also be served at
 * `https://kartawarta.com/indexnow-key.txt` for the spec-required `keyLocation`
 * verification). Falls back to `SystemSetting.indexnow_key` then env
 * `INDEXNOW_KEY` for edge cases (e.g. serverless without fs access).
 *
 * Docs: https://www.indexnow.org/documentation
 */

import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const DEFAULT_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — short enough to pick up rotated keys without a PM2 restart.

let cachedKey: { value: string; expiresAt: number } | null = null;

/**
 * Test-only: drop the cached key so the next `getIndexNowKey()` resolves
 * fresh from disk / DB / env. Not exported in the production path.
 */
export function _resetIndexNowKeyCache(): void {
  cachedKey = null;
}

export interface IndexNowResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Read the IndexNow key from `public/indexnow-key.txt`, with SystemSetting
 * and env fallbacks.
 */
export async function getIndexNowKey(): Promise<string | null> {
  // Return the cached key only if it hasn't expired. The TTL is short so a
  // SystemSetting rotation propagates within ~5min without a PM2 restart.
  if (cachedKey && Date.now() < cachedKey.expiresAt) {
    return cachedKey.value;
  }

  let resolved: string | null = null;

  // 1. public/indexnow-key.txt (canonical location)
  try {
    const filePath = path.join(process.cwd(), "public", "indexnow-key.txt");
    const contents = (await fs.readFile(filePath, "utf-8")).trim();
    if (contents.length > 0) {
      resolved = contents;
    }
  } catch {
    // fall through
  }

  // 2. SystemSetting
  if (!resolved) {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: "indexnow_key" },
      });
      if (setting?.value && setting.value.trim().length > 0) {
        resolved = decryptSecret(setting.value.trim());
      }
    } catch {
      // fall through
    }
  }

  // 3. env
  if (!resolved) {
    const envValue = process.env.INDEXNOW_KEY;
    if (envValue && envValue.trim().length > 0) {
      resolved = envValue.trim();
    }
  }

  if (resolved) {
    cachedKey = { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS };
    return resolved;
  }

  // Misses are NOT cached — that way the next request gets a fresh chance
  // once the operator finishes configuring the key.
  return null;
}

/**
 * Ping IndexNow with a batch of URLs (max 10,000 per request per spec).
 * Returns `{ success: false, error }` on missing key / network failure —
 * never throws.
 */
export async function pingIndexNow(urls: string[]): Promise<IndexNowResult> {
  if (urls.length === 0) {
    return { success: true, statusCode: 200 };
  }

  // Respect the `indexnow_enabled` toggle (default ON — opt-out, mirroring the
  // Google Indexing API gate in google-indexing.ts). Until now this setting
  // was displayed in the SEO panel but never enforced, so the "✗ IndexNow"
  // indicator could claim disabled while pings kept firing. An explicit
  // "false"/"0"/"no"/"off" now actually halts pinging. DB failure → fail-open
  // (continue) so a transient outage never silently stops indexing.
  try {
    const toggle = await prisma.systemSetting.findUnique({
      where: { key: "indexnow_enabled" },
    });
    if (toggle?.value) {
      const v = toggle.value.trim().toLowerCase();
      if (v === "false" || v === "0" || v === "no" || v === "off") {
        return { success: false, error: "IndexNow disabled via setting" };
      }
    }
  } catch {
    // DB unavailable — fail open and proceed with the ping.
  }

  const key = await getIndexNowKey();
  if (!key) {
    return { success: false, error: "IndexNow key not configured" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  const host = new URL(siteUrl).hostname;
  const keyLocation = `${siteUrl.replace(/\/$/, "")}/indexnow-key.txt`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation,
        urlList: urls,
      }),
      signal: controller.signal,
    });

    // IndexNow treats 200 and 202 as success.
    const ok = response.status === 200 || response.status === 202;
    if (!ok) {
      const body = await response.text().catch(() => "");
      return {
        success: false,
        statusCode: response.status,
        error: `IndexNow HTTP ${response.status}: ${body.slice(0, 200)}`,
      };
    }
    return { success: true, statusCode: response.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}
