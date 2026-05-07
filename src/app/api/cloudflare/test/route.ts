/**
 * GET /api/cloudflare/test
 *
 * Lightweight connectivity test for the Cloudflare integration.
 * Hits GET /zones/:zone_id to verify that the configured API token
 * is valid and has Zone Read permission.
 *
 * Auth: SUPER_ADMIN only.
 * Returns: { ok, zone?: { name, status }, error?, durationMs }
 */

import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

export const dynamic = "force-dynamic";

interface ZoneDetail {
  name: string;
  status: string;
}

interface TestResult {
  ok: boolean;
  zone?: ZoneDetail;
  error?: string;
  durationMs: number;
}

async function probeCloudflare(): Promise<TestResult> {
  const started = Date.now();

  // Read credentials from SystemSetting (env fallback)
  const [tokenRow, zoneRow] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: "cloudflare_api_token" } }).catch(() => null),
    prisma.systemSetting.findUnique({ where: { key: "cloudflare_zone_id" } }).catch(() => null),
  ]);

  const token = tokenRow?.value
    ? decryptSecret(tokenRow.value)
    : process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = zoneRow?.value || process.env.CLOUDFLARE_ZONE_ID;

  if (!token || !zoneId) {
    return {
      ok: false,
      error: "Cloudflare credentials not configured (cloudflare_api_token + cloudflare_zone_id required)",
      durationMs: Date.now() - started,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      result?: { name?: string; status?: string };
      errors?: Array<{ message: string }>;
    } | null;

    if (!json?.success) {
      const errMsg = json?.errors?.[0]?.message || `HTTP ${res.status}`;
      return { ok: false, error: errMsg, durationMs: Date.now() - started };
    }

    return {
      ok: true,
      zone: {
        name: json.result?.name ?? "",
        status: json.result?.status ?? "",
      },
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - started,
    };
  }
}

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const result = await probeCloudflare();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
