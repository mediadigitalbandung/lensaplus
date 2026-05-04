/**
 * POST /api/email/test
 * Send a test email via Resend to verify API key + from-address config.
 *
 * Body: { to?: string }
 *   - Defaults to current session user's email.
 *
 * Reads `resend_api_key` and `notification_email_from` from SystemSetting,
 * falling back to env (RESEND_API_KEY, EMAIL_FROM).
 *
 * Auth: SUPER_ADMIN
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import {
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { decryptSecret, isSensitiveKey } from "@/lib/crypto-secrets";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  to: z.string().email("Email tujuan tidak valid").optional(),
});

async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (row?.value && row.value.trim().length > 0) {
      const raw = row.value.trim();
      return isSensitiveKey(key) ? decryptSecret(raw) : raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const raw = await req.json().catch(() => ({}));
    const { to } = bodySchema.parse(raw || {});

    const recipient = to || session.user?.email;
    if (!recipient) {
      return successResponse({
        success: false,
        error: "Email tujuan tidak tersedia (sesi tanpa email).",
      });
    }

    const apiKey =
      (await getSetting("resend_api_key")) || process.env.RESEND_API_KEY || null;
    if (!apiKey) {
      return successResponse({
        success: false,
        error:
          "Resend API key belum dikonfigurasi (SystemSetting `resend_api_key` atau env RESEND_API_KEY).",
      });
    }

    const fromEmail =
      (await getSetting("notification_email_from")) ||
      process.env.EMAIL_FROM ||
      "Kartawarta <noreply@kartawarta.com>";

    const resend = new Resend(apiKey);

    const html = `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#002045;">Tes Koneksi Resend dari Kartawarta</h1>
          <p style="color:#44474e;line-height:1.6;font-size:14px;">
            Email ini terkirim sebagai konfirmasi bahwa kredensial Resend di Kartawarta berfungsi normal.
          </p>
          <p style="color:#74777f;line-height:1.6;font-size:12px;margin-top:24px;">
            Diuji oleh: ${session.user?.email || session.user?.id || "(unknown)"}<br/>
            Waktu: ${new Date().toISOString()}
          </p>
        </div>
      </div>
    `.trim();

    try {
      const result = await resend.emails.send({
        from: fromEmail,
        to: recipient,
        subject: "Tes Koneksi Resend dari Kartawarta",
        html,
      });

      // Resend SDK v6 returns { data, error }
      if (result?.error) {
        const e = result.error;
        return successResponse({
          success: false,
          error:
            typeof e === "string"
              ? e
              : (e as { message?: string })?.message || JSON.stringify(e),
          to: recipient,
          from: fromEmail,
        });
      }

      return successResponse({
        success: true,
        to: recipient,
        from: fromEmail,
      });
    } catch (sendErr) {
      return successResponse({
        success: false,
        error:
          sendErr instanceof Error ? sendErr.message : String(sendErr),
        to: recipient,
        from: fromEmail,
      });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
