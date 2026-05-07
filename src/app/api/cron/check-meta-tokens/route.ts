/**
 * GET /api/cron/check-meta-tokens
 *
 * Weekly cron: hit Meta Graph API /debug_token for each configured access
 * token (Instagram + Facebook), update tokenExpiresAt in DB, and send a
 * warning email to SUPER_ADMINs when expiry is within 14 days (or already
 * past).
 *
 * Recommended VPS crontab cadence: every Monday at 09:00 WIB (UTC+7 = 02:00 UTC)
 *   0 2 * * 1 curl -sS -X GET -H "Authorization: Bearer ${CRON_SECRET}" \
 *     https://kartawarta.com/api/cron/check-meta-tokens \
 *     >> /var/log/kartawarta-cron.log 2>&1
 *
 * Endpoint never throws — returns HTTP 200 with {success, ...} so cron does
 * not retry-spam.
 *
 * CRIT-11 fix: was previously unimplemented; tokens could expire silently on
 * day 60 with no warning, blocking the IG/FB publish pipeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { verifyCronSecret, errorResponse, logAudit } from "@/lib/api-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const WARN_DAYS = 14; // warn when fewer than this many days remain

interface DebugTokenData {
  data?: {
    is_valid?: boolean;
    expires_at?: number; // Unix timestamp; 0 = never expires
    scopes?: string[];
    app_id?: string;
    type?: string;
  };
  error?: {
    message?: string;
    code?: number;
  };
}

interface TokenCheckResult {
  platform: "instagram" | "facebook";
  expiresAt: Date | null;
  daysLeft: number | null;
  neverExpires: boolean;
  isValid: boolean | null;
  warning: "expired" | "expiring_soon" | null;
  error?: string;
}

async function debugToken(
  accessToken: string,
  appAccessToken: string,
): Promise<{ expiresAt: Date | null; isValid: boolean | null; neverExpires: boolean; error?: string }> {
  try {
    const url = `${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    const json: DebugTokenData = await res.json();
    if (!res.ok || json.error) {
      return {
        expiresAt: null,
        isValid: null,
        neverExpires: false,
        error: json.error?.message || `HTTP ${res.status}`,
      };
    }
    const data = json.data;
    if (!data) {
      return { expiresAt: null, isValid: null, neverExpires: false, error: "Empty debug_token data" };
    }
    const expiresAtUnix = data.expires_at ?? 0;
    if (expiresAtUnix === 0) {
      // 0 means the token never expires (system user / app token)
      return { expiresAt: null, isValid: data.is_valid ?? null, neverExpires: true };
    }
    return {
      expiresAt: new Date(expiresAtUnix * 1000),
      isValid: data.is_valid ?? null,
      neverExpires: false,
    };
  } catch (e) {
    return {
      expiresAt: null,
      isValid: null,
      neverExpires: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function daysUntil(date: Date): number {
  return Math.floor((date.getTime() - Date.now()) / 86_400_000);
}

async function getSuperAdminEmails(): Promise<string[]> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: { email: true },
    });
    return admins.map((u) => u.email).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

async function handler(req: NextRequest) {
  const started = Date.now();
  try {
    try { verifyCronSecret(req); } catch (e) { return errorResponse(e); }

    const [igSettings, fbSettings] = await Promise.all([
      prisma.instagramSettings.findUnique({ where: { id: "global" } }),
      prisma.facebookSettings.findUnique({ where: { id: "global" } }),
    ]);

    const results: TokenCheckResult[] = [];

    // Instagram uses its own access token as both input + app token for
    // debug_token (works for long-lived user tokens).
    if (igSettings?.accessToken) {
      const checked = await debugToken(igSettings.accessToken, igSettings.accessToken);
      const result: TokenCheckResult = {
        platform: "instagram",
        expiresAt: checked.expiresAt,
        daysLeft: checked.expiresAt ? daysUntil(checked.expiresAt) : null,
        neverExpires: checked.neverExpires,
        isValid: checked.isValid,
        warning: null,
        error: checked.error,
      };
      if (!checked.error && !checked.neverExpires && checked.expiresAt) {
        result.daysLeft = daysUntil(checked.expiresAt);
        if (result.daysLeft < 0) result.warning = "expired";
        else if (result.daysLeft < WARN_DAYS) result.warning = "expiring_soon";
        // Persist updated tokenExpiresAt
        try {
          await prisma.instagramSettings.update({
            where: { id: "global" },
            data: { tokenExpiresAt: checked.expiresAt },
          });
        } catch { /* non-fatal */ }
      }
      results.push(result);
    }

    if (fbSettings?.accessToken) {
      const checked = await debugToken(fbSettings.accessToken, fbSettings.accessToken);
      const result: TokenCheckResult = {
        platform: "facebook",
        expiresAt: checked.expiresAt,
        daysLeft: checked.expiresAt ? daysUntil(checked.expiresAt) : null,
        neverExpires: checked.neverExpires,
        isValid: checked.isValid,
        warning: null,
        error: checked.error,
      };
      if (!checked.error && !checked.neverExpires && checked.expiresAt) {
        result.daysLeft = daysUntil(checked.expiresAt);
        if (result.daysLeft < 0) result.warning = "expired";
        else if (result.daysLeft < WARN_DAYS) result.warning = "expiring_soon";
        try {
          await prisma.facebookSettings.update({
            where: { id: "global" },
            data: { tokenExpiresAt: checked.expiresAt },
          });
        } catch { /* non-fatal */ }
      }
      results.push(result);
    }

    // Send warning emails for platforms that need attention
    const needsWarning = results.filter((r) => r.warning !== null);
    if (needsWarning.length > 0) {
      const adminEmails = await getSuperAdminEmails();
      for (const r of needsWarning) {
        const isExpired = r.warning === "expired";
        const label = r.platform === "instagram" ? "Instagram" : "Facebook Page";
        const subject = isExpired
          ? `[KARTAWARTA] EXPIRED — Meta ${label} token sudah kedaluwarsa`
          : `[KARTAWARTA] Peringatan — Meta ${label} token habis dalam ${r.daysLeft} hari`;
        const bodyHtml = `
          <div style="font-family:Work Sans,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;">
            <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
              <h2 style="color:#002045;margin:0 0 16px;">${isExpired ? "Token Kedaluwarsa" : "Token Akan Habis"}</h2>
              <p style="color:#44474e;line-height:1.6;">
                Access token untuk <strong>${label}</strong> ${isExpired ? "sudah <strong>kedaluwarsa</strong>" : `akan habis dalam <strong>${r.daysLeft} hari</strong>`}
                (${r.expiresAt ? r.expiresAt.toISOString() : "tidak diketahui"}).
              </p>
              ${isExpired
                ? `<div style="background:#fef2f2;border-left:4px solid #b7102a;padding:12px 16px;border-radius:6px;margin:16px 0;">
                    <p style="margin:0;color:#991b1b;font-size:14px;"><strong>Pipeline ${label} saat ini tidak dapat mempost.</strong> Segera generate ulang long-lived token.</p>
                   </div>`
                : `<div style="background:#e8edf3;border-left:4px solid #002045;padding:12px 16px;border-radius:6px;margin:16px 0;">
                    <p style="margin:0;color:#002045;font-size:14px;">Harap perbarui token sebelum kedaluwarsa untuk menghindari gangguan posting otomatis.</p>
                   </div>`
              }
              <p style="color:#74777f;font-size:12px;margin-top:16px;">
                Perbarui token di: Panel &rarr; Pengaturan &rarr; Media Sosial
              </p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com"}/panel/social/settings"
                   style="display:inline-block;background:#002045;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
                  Perbarui Token Sekarang
                </a>
              </div>
            </div>
          </div>`;
        for (const email of adminEmails) {
          await sendEmail({ to: email, subject, html: bodyHtml });
        }
      }
    }

    // Build summary for audit log + response
    const summary: Record<string, { expiresAt: string | null; daysLeft: number | null; warning: string | null; neverExpires: boolean }> = {};
    for (const r of results) {
      summary[r.platform] = {
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        daysLeft: r.daysLeft,
        warning: r.warning,
        neverExpires: r.neverExpires,
      };
    }

    await logAudit("system", "META_TOKEN_CHECK", "MetaSettings", "global", JSON.stringify(summary));

    return NextResponse.json(
      {
        success: true,
        checked: results.length,
        warnings: needsWarning.length,
        summary,
        durationMs: Date.now() - started,
      },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - started,
      },
      { status: 200 },
    );
  }
}

export async function GET(req: NextRequest) {
  try { return await handler(req); } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  try { return await handler(req); } catch (e) { return errorResponse(e); }
}
