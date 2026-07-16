import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils";
import { sendEmail } from "@/lib/email";
import { commentRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  email: z.string().email("Email tidak valid").transform((v) => v.toLowerCase().trim()),
  source: z.string().max(40).optional(),
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";

/**
 * POST /api/newsletter/subscribe — public, double-opt-in.
 *
 * Behavior:
 *   - Idempotent on email; if already subscribed and confirmed, return ok.
 *   - If previously unsubscribed, regenerate token and re-issue confirm email.
 *   - Otherwise create a new subscriber and send confirm email.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: allowed } = commentRateLimit(ip);
    if (!allowed) throw new ApiError("Terlalu banyak permintaan. Coba lagi nanti.", 429);

    const body = await request.json();
    const data = subscribeSchema.parse(body);

    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email: data.email },
    });

    let subscriber;
    if (existing && existing.confirmedAt && !existing.unsubscribedAt) {
      // Already subscribed — return success without spamming with another confirm.
      return successResponse({
        status: "already-subscribed",
        message: "Email Anda sudah terdaftar.",
      });
    } else if (existing) {
      // Re-subscribe / re-confirm: regenerate token, clear unsubscribe.
      subscriber = await prisma.newsletterSubscriber.update({
        where: { email: data.email },
        data: {
          token: undefined, // regen via @default(cuid()) doesn't fire on update
          unsubscribedAt: null,
          source: data.source || existing.source,
          signupIp: ip,
        },
      });
      // Force token regen explicitly
      subscriber = await prisma.newsletterSubscriber.update({
        where: { email: data.email },
        data: { token: cryptoRandom() },
      });
    } else {
      subscriber = await prisma.newsletterSubscriber.create({
        data: {
          email: data.email,
          source: data.source || "form",
          signupIp: ip,
        },
      });
    }

    const confirmUrl = `${SITE_URL}/api/newsletter/confirm?token=${subscriber.token}`;
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #191c1d;">
        <h2 style="color: #002045;">Konfirmasi Berlangganan Lensaplus</h2>
        <p>Halo,</p>
        <p>Terima kasih telah berlangganan newsletter mingguan Lensaplus — kabar hukum dan investigasi pilihan dari Bandung.</p>
        <p>Klik tombol di bawah untuk mengaktifkan langganan Anda:</p>
        <p style="margin: 24px 0;">
          <a href="${confirmUrl}" style="display:inline-block; background:#002045; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:600;">Konfirmasi Email</a>
        </p>
        <p style="color:#74777f; font-size:12px;">Jika Anda tidak mendaftar, abaikan saja email ini — Anda tidak akan menerima email lain.</p>
      </div>
    `;
    await sendEmail(data.email, "Konfirmasi Berlangganan Lensaplus", html);

    return successResponse({
      status: "pending-confirmation",
      message: "Cek email Anda untuk mengonfirmasi langganan.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function cryptoRandom(): string {
  // Reuse cuid pattern via uuid-ish random. The schema default already does
  // cuid on create, but for re-subscribe we need a fresh value here.
  return "ck" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
