/**
 * PUT /api/users/me/password
 *
 * Self-service password change. Requires current password verification.
 * After a successful change, invalidates activeSessionId so all other
 * sessions (including stolen sessions) become invalid within the next
 * JWT revalidation cycle (≤10 minutes per auth.ts checkSession interval).
 *
 * Auth: requireAuth (own account only)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  requireAuth,
  logAudit,
  ApiError,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  newPassword: z
    .string()
    .min(8, "Password baru minimal 8 karakter")
    .max(128, "Password baru maksimal 128 karakter"),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await req.json();
    const data = passwordChangeSchema.parse(body);

    // Fetch stored hash
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user) throw new ApiError("Pengguna tidak ditemukan", 404);

    // Verify current password
    const match = await bcrypt.compare(data.currentPassword, user.password ?? "");
    if (!match) {
      throw new ApiError("Password saat ini tidak benar", 401);
    }

    // Prevent reuse of same password
    const samePassword = await bcrypt.compare(data.newPassword, user.password ?? "");
    if (samePassword) {
      throw new ApiError("Password baru tidak boleh sama dengan password saat ini", 400);
    }

    const hashedNew = await bcrypt.hash(data.newPassword, 12);

    // Invalidate activeSessionId so all other active sessions are kicked
    // within the next JWT revalidation interval (≤10 min). This mitigates
    // stolen-session persistence after a password change.
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedNew,
        activeSessionId: null,
      },
    });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(
      session.user.id,
      "PASSWORD_CHANGE",
      "User",
      session.user.id,
      "Self-service password change — all sessions invalidated",
      ip,
    );

    return successResponse({ message: "Password berhasil diubah. Silakan login kembali." });
  } catch (error) {
    return errorResponse(error);
  }
}
