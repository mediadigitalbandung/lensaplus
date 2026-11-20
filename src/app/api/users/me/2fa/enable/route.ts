/**
 * POST /api/users/me/2fa/enable  { code }
 * Confirm enrollment: verify a code from the authenticator app, then turn 2FA
 * on and return one-time backup codes (shown ONCE).
 */
import { NextRequest } from "next/server";
import { requireAuth, successResponse, errorResponse, ApiError, logAudit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";
import { verifyTotp, generateBackupCodes, hashBackupCodes } from "@/lib/totp";
import { twoFactorRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const rl = twoFactorRateLimit(session.user.id);
    if (!rl.success) {
      throw new ApiError("Terlalu banyak percobaan verifikasi 2FA. Coba lagi dalam 15 menit.", 429);
    }
    const { code } = await req.json().catch(() => ({ code: "" }));

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!user) throw new ApiError("User tidak ditemukan", 404);
    if (user.twoFactorEnabled) throw new ApiError("2FA sudah aktif.", 400);
    if (!user.twoFactorSecret) throw new ApiError("Mulai pengaturan 2FA terlebih dahulu.", 400);

    const secret = decryptSecret(user.twoFactorSecret);
    if (!verifyTotp(secret, String(code || ""))) {
      throw new ApiError("Kode verifikasi salah. Pastikan jam perangkat akurat lalu coba lagi.", 400);
    }

    const backupCodes = generateBackupCodes();
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: hashBackupCodes(backupCodes) },
    });

    await logAudit(
      session.user.id,
      "TWO_FACTOR_ENABLE",
      "User",
      session.user.id,
      "User enabled 2FA",
      getClientIp(req),
    );

    return successResponse({ enabled: true, backupCodes });
  } catch (error) {
    return errorResponse(error);
  }
}
