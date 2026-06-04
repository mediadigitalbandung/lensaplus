/**
 * POST /api/users/me/2fa/setup
 * Begin TOTP enrollment: generate a secret (stored encrypted, NOT yet enabled)
 * and return the otpauth URI + a QR data URL to scan. Enable is a separate
 * step that confirms the user can produce a valid code.
 */
import QRCode from "qrcode";
import { requireAuth, successResponse, errorResponse, ApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto-secrets";
import { generateTotpSecret, otpauthUri } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await requireAuth();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, twoFactorEnabled: true },
    });
    if (!user) throw new ApiError("User tidak ditemukan", 404);
    if (user.twoFactorEnabled) throw new ApiError("2FA sudah aktif. Nonaktifkan dulu untuk mengatur ulang.", 400);

    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: encryptSecret(secret) },
    });

    const uri = otpauthUri(secret, user.email, "Kartawarta");
    const qr = await QRCode.toDataURL(uri, { width: 240, margin: 1 });
    // `secret` returned so the user can enter it manually if they can't scan.
    return successResponse({ secret, otpauth: uri, qr });
  } catch (error) {
    return errorResponse(error);
  }
}
