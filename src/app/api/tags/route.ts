import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse, requireRole, logAudit } from "@/lib/api-utils";
import { slugify } from "@/lib/utils";

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

    const tag = await prisma.tag.create({
      data: {
        name: data.name,
        slug: data.slug || slugify(data.name),
      },
    });

    await logAudit(session.user.id, "CREATE", "tag", tag.id, `Membuat tag: ${tag.name}`);

    return successResponse(tag, 201);
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
      return errorResponse(new Error("ID tag diperlukan"));
    }

    const tag = await prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { articles: true } } },
    });

    if (!tag) {
      return errorResponse(new Error("Tag tidak ditemukan"));
    }

    await prisma.tag.delete({ where: { id } });

    await logAudit(session.user.id, "DELETE", "tag", id, `Menghapus tag: ${tag.name}`);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
