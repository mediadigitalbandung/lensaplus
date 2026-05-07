import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse, requireRole, logAudit } from "@/lib/api-utils";

// GET /api/redaksi — public
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

    const [members, total] = await Promise.all([
      prisma.redaksiMember.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.redaksiMember.count({ where: { isActive: true } }),
    ]);

    return successResponse({ members, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return errorResponse(error);
  }
}

const createSchema = z.object({
  position: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  desc: z.string().max(300).optional().nullable(),
  photo: z.string().url().optional().nullable(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// POST /api/redaksi — admin only
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);
    const body = await request.json();
    const data = createSchema.parse(body);

    const member = await prisma.redaksiMember.create({
      data: {
        position: data.position,
        name: data.name,
        desc: data.desc || null,
        photo: data.photo || null,
        order: data.order ?? 0,
        isActive: data.isActive ?? true,
      },
    });

    await logAudit(session.user.id, "CREATE", "redaksi", member.id, `Menambah redaksi: ${data.position} - ${data.name}`);
    return successResponse(member, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
