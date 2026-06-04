/**
 * POST /api/users/me/2fa/disable  { password, code }
 * Turn 2FA off. Requires BOTH the account password and a current TOTP code
 * (or a backup code) so a hijacked open session can't silently remove 2FA.
 */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth, successResponse, errorResponse, ApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";
import { verifyTotp, consumeBackupCode } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { password, code } = await req.json().catch(() => ({ password: "", code: "" }));

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true, twoFactorEnabled: true, twoFactorSecret: true, twoFactorBackupCodes: true },
    });
    if (!user) throw new ApiError("User tidak ditemukan", 404);
    if (!user.twoFactorEnabled) throw new ApiError("2FA belum aktif.", 400);

    const okPassword = await bcrypt.compare(String(password || ""), user.password);
    if (!okPassword) throw new ApiError("Password salah.", 400);

    const secret = user.twoFactorSecret ? decryptSecret(user.twoFactorSecret) : "";
    const okCode =
      (secret && verifyTotp(secret, String(code || ""))) ||
      consumeBackupCode(user.twoFactorBackupCodes, String(code || "")) !== null;
    if (!okCode) throw new ApiError("Kode 2FA salah.", 400);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null },
    });
    return successResponse({ disabled: true });
  } catch (error) {
    return errorResponse(error);
  }
}
