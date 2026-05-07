import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  requireRole,
  logAudit,
  ApiError,
} from "@/lib/api-utils";
import { listEmailRules, deleteEmailRule } from "@/lib/cloudflare-email";

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR", "SENIOR_JOURNALIST", "JOURNALIST", "CONTRIBUTOR"]).optional(),
  specialization: z.string().max(100).optional(),
  avatar: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
});

// PUT /api/users/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      throw new ApiError("Pengguna tidak ditemukan", 404);
    }

    const body = await request.json();
    const data = updateUserSchema.parse(body);

    // If email is being changed, check for duplicates
    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        throw new ApiError("Email sudah digunakan oleh pengguna lain", 400);
      }
    }

    // Hash password if provided; also invalidate active sessions so the
    // target user is forced to re-authenticate with the new password.
    const updateData: Record<string, unknown> = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
      updateData.activeSessionId = null;
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        specialization: true,
        isActive: true,
      },
    });

    await logAudit(
      session.user.id,
      "UPDATE",
      "user",
      params.id,
      `Mengupdate pengguna: ${user.name} (${user.email})`
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/users/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      throw new ApiError("Pengguna tidak ditemukan", 404);
    }

    if (user.id === session.user.id) {
      throw new ApiError("Tidak dapat menghapus akun sendiri", 400);
    }

    await prisma.user.delete({ where: { id: params.id } });

    // Auto-delete associated email routing rules
    try {
      const rules = await listEmailRules();
      const userRules = rules.filter((r) => {
        const forwardTo = r.actions.find((a) => a.type === "forward")?.value?.[0];
        return forwardTo === user.email;
      });
      for (const rule of userRules) {
        await deleteEmailRule(rule.id);
      }
    } catch {
      // Non-critical
    }

    await logAudit(
      session.user.id,
      "DELETE",
      "user",
      params.id,
      `Menghapus pengguna: ${user.name} (${user.email})`
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
