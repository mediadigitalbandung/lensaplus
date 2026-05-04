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

let cachedKey: string | null = null;

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
  if (cachedKey) return cachedKey;

  // 1. public/indexnow-key.txt (canonical location)
  try {
    const filePath = path.join(process.cwd(), "public", "indexnow-key.txt");
    const contents = (await fs.readFile(filePath, "utf-8")).trim();
    if (contents.length > 0) {
      cachedKey = contents;
      return cachedKey;
    }
  } catch {
    // fall through
  }

  // 2. SystemSetting
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "indexnow_key" },
    });
    if (setting?.value && setting.value.trim().length > 0) {
      cachedKey = decryptSecret(setting.value.trim());
      return cachedKey;
    }
  } catch {
    // fall through
  }

  // 3. env
  const envValue = process.env.INDEXNOW_KEY;
  if (envValue && envValue.trim().length > 0) {
    cachedKey = envValue.trim();
    return cachedKey;
  }

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
