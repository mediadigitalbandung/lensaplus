/**
 * /api/target-keywords
 * Manage TargetKeyword rows used by `/api/cron/auto-article`.
 *
 * GET    — list. Filters: ?isActive=true|false, ?categoryId=, ?q=
 *          Auth: SUPER_ADMIN (aligned with /panel/auto-artikel in src/proxy.ts)
 * POST   — create. Body: { keyword, categoryId?, priority? }
 *          Auth: SUPER_ADMIN
 * PATCH  — toggle (or update fields). Body: { id, isActive?, priority?, categoryId?, keyword? }
 *          Auth: SUPER_ADMIN
 * DELETE — ?id=...  Auth: SUPER_ADMIN
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
  parsePositiveInt,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  keyword: z.string().min(2, "Keyword minimal 2 karakter").max(255),
  categoryId: z.string().nullable().optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  categoryId: z.string().nullable().optional(),
  keyword: z.string().min(2).max(255).optional(),
});

const ADMIN_ONLY_ROLES = ["SUPER_ADMIN"] as const;

export async function GET(req: NextRequest) {
  try {
    await requireRole([...ADMIN_ONLY_ROLES]);
    const { searchParams } = new URL(req.url);
    const isActiveParam = searchParams.get("isActive");
    const categoryId = searchParams.get("categoryId");
    const q = searchParams.get("q");
    const limit = parsePositiveInt(searchParams.get("limit"), 100, 100);
    const page = parsePositiveInt(searchParams.get("page"), 1);

    const where: Record<string, unknown> = {};
    if (isActiveParam !== null && isActiveParam !== "") {
      where.isActive = isActiveParam === "true";
    }
    if (categoryId) where.categoryId = categoryId;
    if (q && q.trim().length > 0) {
      where.keyword = { contains: q.trim(), mode: "insensitive" };
    }

    const [keywords, total] = await Promise.all([
      prisma.targetKeyword.findMany({
        where,
        orderBy: [{ priority: "desc" }, { keyword: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.targetKeyword.count({ where }),
    ]);

    return successResponse({ keywords, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole([...ADMIN_ONLY_ROLES]);
    const body = await req.json();
    const data = createSchema.parse(body);

    // Unique check by keyword
    const existing = await prisma.targetKeyword.findUnique({
      where: { keyword: data.keyword },
    });
    if (existing) {
      throw new ApiError("Keyword sudah ada", 409);
    }

    const created = await prisma.targetKeyword.create({
      data: {
        keyword: data.keyword,
        categoryId: data.categoryId || null,
        priority: data.priority ?? 0,
        isActive: true,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    await logAudit(
      session.user.id,
      "CREATE",
      "target_keyword",
      created.id,
      `Tambah target keyword: ${created.keyword} (priority=${created.priority})`,
    );

    return successResponse(created, 201);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireRole([...ADMIN_ONLY_ROLES]);
    const body = await req.json();
    const data = patchSchema.parse(body);

    const exists = await prisma.targetKeyword.findUnique({
      where: { id: data.id },
    });
    if (!exists) throw new ApiError("Keyword tidak ditemukan", 404);

    const updateData: Record<string, unknown> = {};
    if (typeof data.isActive === "boolean") updateData.isActive = data.isActive;
    if (typeof data.priority === "number") updateData.priority = data.priority;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
    if (data.keyword !== undefined) updateData.keyword = data.keyword;

    const updated = await prisma.targetKeyword.update({
      where: { id: data.id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    await logAudit(
      session.user.id,
      "UPDATE",
      "target_keyword",
      updated.id,
      `Update target keyword: ${updated.keyword}`,
    );

    return successResponse(updated);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) throw new ApiError("ID keyword diperlukan", 400);

    const existing = await prisma.targetKeyword.findUnique({ where: { id } });
    if (!existing) throw new ApiError("Keyword tidak ditemukan", 404);

    await prisma.targetKeyword.delete({ where: { id } });

    await logAudit(
      session.user.id,
      "DELETE",
      "target_keyword",
      id,
      `Hapus target keyword: ${existing.keyword}`,
    );

    return successResponse({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
