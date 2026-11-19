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
import { isSafeImageRef } from "@/lib/safe-path";

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR", "SENIOR_JOURNALIST", "JOURNALIST", "CONTRIBUTOR"]).optional(),
  specialization: z.string().max(100).optional(),
  avatar: z
    .string()
    .refine(isSafeImageRef, "URL atau path avatar tidak valid")
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

// PUT /api/users/:id
export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    // User management (esp. role/password/isActive) is SUPER_ADMIN-only —
    // matches canManageUsers, the POST creator, and the DELETE handler.
    // Previously CHIEF_EDITOR could PUT here and set role=SUPER_ADMIN or reset
    // an admin's password (+ null activeSessionId) → privilege escalation.
    const session = await requireRole(["SUPER_ADMIN"]);

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      throw new ApiError("Pengguna tidak ditemukan", 404);
    }

    const body = await request.json();
    const data = updateUserSchema.parse(body);

    const normalizedEmail = data.email ? data.email.trim().toLowerCase() : undefined;

    // If email is being changed, check for duplicates
    if (normalizedEmail && normalizedEmail !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        throw new ApiError("Email sudah digunakan oleh pengguna lain", 400);
      }
    }

    // Prevent locking out the last active SUPER_ADMIN via deactivation or demotion.
    const isDeactivating = data.isActive === false;
    const isDemotingSuperAdmin =
      user.role === "SUPER_ADMIN" && data.role !== undefined && data.role !== "SUPER_ADMIN";
    if (user.role === "SUPER_ADMIN" && user.isActive && (isDeactivating || isDemotingSuperAdmin)) {
      const activeSuperAdmins = await prisma.user.count({
        where: { role: "SUPER_ADMIN", isActive: true },
      });
      if (activeSuperAdmins <= 1) {
        throw new ApiError(
          "Tidak dapat menonaktifkan atau menurunkan peran Super Admin aktif terakhir.",
          409,
        );
      }
    }

    // Hash password if provided; also invalidate active sessions when
    // password changes, account is deactivated, or role changes.
    const updateData: Record<string, unknown> = {
      ...data,
      ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
    };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
      updateData.activeSessionId = null;
    } else if (isDeactivating || (data.role && data.role !== user.role)) {
      updateData.activeSessionId = null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
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

      // Automatically revoke the user's press membership card (KTA) when deactivated
      // so inactive accounts can never verify as active press members.
      if (isDeactivating) {
        await tx.membershipCard.updateMany({
          where: { userId: params.id, status: { not: "REVOKED" } },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
            notes: "Dicabut otomatis saat akun dinonaktifkan oleh admin.",
          },
        });
      }

      return u;
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
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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

    // Check restricting FK relations (Article, LiveBlog) upfront to return a clear HTTP 409.
    const [articleCount, liveBlogCount] = await Promise.all([
      prisma.article.count({ where: { authorId: params.id } }),
      prisma.liveBlog.count({ where: { authorId: params.id } }),
    ]);

    if (articleCount > 0 || liveBlogCount > 0) {
      const parts: string[] = [];
      if (articleCount > 0) parts.push(`${articleCount} artikel`);
      if (liveBlogCount > 0) parts.push(`${liveBlogCount} live blog`);
      throw new ApiError(
        `Pengguna tidak dapat dihapus karena masih memiliki ${parts.join(" dan ")}. Alihkan kepemilikan konten tersebut terlebih dahulu atau nonaktifkan akun pengguna ini.`,
        409,
      );
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Revoke KTA card before deletion (MembershipCard also cascades with User).
        await tx.membershipCard.updateMany({
          where: { userId: params.id },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
            holderName: null,
            holderPhoto: null,
          },
        });

        // Clean up rows in tables that reference user IDs without a DB foreign key.
        await tx.notification.deleteMany({ where: { userId: params.id } });
        await tx.tiktokContent.deleteMany({ where: { createdById: params.id } });
        await tx.tiktokAccount.deleteMany({ where: { ownerId: params.id } });
        await tx.youtubeClipJob.deleteMany({ where: { requestedById: params.id } });
        await tx.article.updateMany({
          where: { assignedEditorId: params.id },
          data: { assignedEditorId: null },
        });
        await tx.liveBlogEntry.updateMany({
          where: { authorId: params.id },
          data: { authorId: null },
        });

        await tx.user.delete({ where: { id: params.id } });
      });
    } catch (err) {
      if (err && typeof err === "object" && (err as { code?: string }).code === "P2003") {
        throw new ApiError(
          "Pengguna tidak dapat dihapus karena masih memiliki artikel atau live blog terkait. Alihkan konten tersebut terlebih dahulu atau nonaktifkan akun pengguna ini.",
          409,
        );
      }
      throw err;
    }

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
