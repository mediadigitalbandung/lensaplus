import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse, requireRole, logAudit } from "@/lib/api-utils";
import { slugify } from "@/lib/utils";

// GET /api/categories
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { articles: true } } },
    });
    return successResponse(categories);
  } catch (error) {
    return errorResponse(error);
  }
}

const createCategorySchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(60).optional(),
  description: z.string().max(200).optional(),
  icon: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

// POST /api/categories
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await request.json();
    const data = createCategorySchema.parse(body);

    const category = await prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug || slugify(data.name),
        description: data.description,
        icon: data.icon,
        order: data.order ?? 0,
      },
    });

    await logAudit(session.user.id, "CREATE", "category", category.id, `Membuat kategori: ${category.name}`);

    return successResponse(category, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
