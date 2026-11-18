import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ApiError, successResponse, errorResponse, requireRole, logAudit } from "@/lib/api-utils";
import { slugify } from "@/lib/utils";
import { rethrowMappedPrismaError } from "@/lib/security";

// GET /api/tags
export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { articles: true } } },
    });
    return successResponse(tags);
  } catch (error) {
    return errorResponse(error);
  }
}

const createTagSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(60).optional(),
});

// POST /api/tags
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await request.json();
    const data = createTagSchema.parse(body);

    const slug = data.slug || slugify(data.name);
    if (!slug) {
      throw new ApiError("Slug tag tidak valid", 400);
    }

    const tag = await prisma.tag
      .create({
        data: {
          name: data.name,
          slug,
        },
      })
      .catch((err) =>
        rethrowMappedPrismaError(err, { unique: "Nama atau slug tag sudah digunakan" }),
      );

    await logAudit(session.user.id, "CREATE", "tag", tag.id, `Membuat tag: ${tag.name}`);

    return successResponse(tag, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

const updateTagSchema = z.object({
  id: z.string().min(1, "ID tag diperlukan"),
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(60).optional(),
});

// PUT /api/tags
export async function PUT(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await request.json();
    const data = updateTagSchema.parse(body);

    const existing = await prisma.tag.findUnique({ where: { id: data.id } });
    if (!existing) {
      return errorResponse(new ApiError("Tag tidak ditemukan", 404));
    }

    const nextSlug = data.slug || slugify(data.name);
    if (!nextSlug) {
      throw new ApiError("Slug tag tidak valid", 400);
    }
    const conflict = await prisma.tag.findFirst({
      where: {
        id: { not: data.id },
        OR: [{ slug: nextSlug }, { name: data.name }],
      },
    });
    if (conflict) {
      return errorResponse(new ApiError("Nama atau slug tag sudah digunakan", 409));
    }

    const updated = await prisma.tag
      .update({
        where: { id: data.id },
        data: { name: data.name, slug: nextSlug },
      })
      .catch((err) =>
        rethrowMappedPrismaError(err, {
          unique: "Nama atau slug tag sudah digunakan",
          notFound: "Tag tidak ditemukan",
        }),
      );

    await logAudit(session.user.id, "UPDATE", "tag", updated.id, `Memperbarui tag: ${updated.name}`);

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/tags
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return errorResponse(new ApiError("ID tag diperlukan", 400));
    }

    const tag = await prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { articles: true } } },
    });

    if (!tag) {
      return errorResponse(new ApiError("Tag tidak ditemukan", 404));
    }

    await prisma.tag.delete({ where: { id } });

    await logAudit(session.user.id, "DELETE", "tag", id, `Menghapus tag: ${tag.name}`);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
