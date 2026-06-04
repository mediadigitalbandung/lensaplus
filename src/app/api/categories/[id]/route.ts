import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse, requireRole, logAudit } from "@/lib/api-utils";
import { slugify } from "@/lib/utils";

const updateCategorySchema = z.object({
  name: z.string().min(2).max(50).optional(),
  slug: z.string().min(2).max(60).optional(),
  description: z.string().max(200).optional().nullable(),
  icon: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

// PUT /api/categories/[id]
export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await request.json();
    const data = updateCategorySchema.parse(body);

    const existing = await prisma.category.findUnique({ where: { id: params.id } });
    if (!existing) {
      return errorResponse(new Error("Kategori tidak ditemukan"));
    }

    const slug = data.name ? (data.slug || slugify(data.name)) : data.slug;

    const category = await prisma.category.update({
      where: { id: params.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(slug && { slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.icon && { icon: data.icon }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });

    await logAudit(session.user.id, "UPDATE", "category", category.id, `Mengubah kategori: ${category.name}`);

    return successResponse(category);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/categories/[id]
export async function DELETE(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const category = await prisma.category.findUnique({
      where: { id: params.id },
      include: { _count: { select: { articles: true } } },
    });

    if (!category) {
      return errorResponse(new Error("Kategori tidak ditemukan"));
    }

    if (category._count.articles > 0) {
      return errorResponse(
        new Error(`Tidak bisa menghapus kategori yang memiliki ${category._count.articles} artikel`)
      );
    }

    await prisma.category.delete({ where: { id: params.id } });

    await logAudit(session.user.id, "DELETE", "category", params.id, `Menghapus kategori: ${category.name}`);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
