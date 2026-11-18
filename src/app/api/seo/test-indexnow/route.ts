/**
 * GET /api/seo/test-indexnow
 *
 * Lightweight connectivity test for the IndexNow integration.
 * Reads the configured key (public/indexnow-key.txt → SystemSetting → env)
 * and submits a single test ping for the site root URL to api.indexnow.org.
 * A 200 or 202 response confirms the key is accepted.
 *
 * Auth: SUPER_ADMIN only.
 * Returns: { ok, status, keyConfigured, error?, durationMs }
 */

import { requireRole, errorResponse, successResponse } from "@/lib/api-utils";
import { getIndexNowKey } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

interface TestResult {
  ok: boolean;
  status?: number;
  keyConfigured: boolean;
  error?: string;
  durationMs: number;
}

async function probeIndexNow(): Promise<TestResult> {
  const started = Date.now();

  const key = await getIndexNowKey();
  if (!key) {
    return {
      ok: false,
      keyConfigured: false,
      error: "IndexNow key not configured (public/indexnow-key.txt, SystemSetting.indexnow_key, or env INDEXNOW_KEY required)",
      durationMs: Date.now() - started,
    };
  }

  const keyLocation = `${SITE_URL.replace(/\/$/, "")}/indexnow-key.txt`;
  const pingUrl = `${INDEXNOW_ENDPOINT}?url=${encodeURIComponent(SITE_URL)}&key=${encodeURIComponent(key)}&keyLocation=${encodeURIComponent(keyLocation)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(pingUrl, {
      method: "GET",
      signal: controller.signal,
    });

    // IndexNow returns 200 (accepted) or 202 (accepted, deferred). Both are OK.
    const ok = res.status === 200 || res.status === 202;

    return {
      ok,
      status: res.status,
      keyConfigured: true,
      ...(!ok ? { error: `Unexpected status ${res.status}` } : {}),
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      ok: false,
      keyConfigured: true,
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const result = await probeIndexNow();
    return successResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
