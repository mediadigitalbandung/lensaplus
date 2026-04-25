import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireAuth,
  successResponse,
} from "@/lib/api-utils";
import { canManageTiktok } from "@/lib/tiktok/specs";

export const dynamic = "force-dynamic";

// GET /api/tiktok/templates — list active templates
export async function GET() {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const templates = await prisma.tiktokTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
    return successResponse(templates);
  } catch (error) {
    return errorResponse(error);
  }
}

const createSchema = z.object({
  key: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/i, "Key harus alphanumeric/dash"),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  htmlPath: z.string().optional().nullable(),
  minSlots: z.number().int().min(1).max(20).optional(),
  maxSlots: z.number().int().min(1).max(20).optional(),
  acceptedKinds: z.string().optional(),
  aspectRatio: z.enum(["PORTRAIT_9_16", "SQUARE_1_1"]).optional(),
  thumbnailUrl: z.string().url().optional().nullable(),
});

// POST /api/tiktok/templates — register a Hyperframes template (Phase 2 prep)
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "SUPER_ADMIN") {
      throw new ApiError("Hanya SUPER_ADMIN yang dapat menambah template", 403);
    }

    const body = await request.json();
    const data = createSchema.parse(body);

    const exists = await prisma.tiktokTemplate.findUnique({ where: { key: data.key } });
    if (exists) throw new ApiError("Template key sudah dipakai", 409);

    const created = await prisma.tiktokTemplate.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description || null,
        htmlPath: data.htmlPath || null,
        minSlots: data.minSlots ?? 1,
        maxSlots: data.maxSlots ?? 10,
        acceptedKinds: data.acceptedKinds || "IMAGE,VIDEO",
        aspectRatio: data.aspectRatio || "PORTRAIT_9_16",
        thumbnailUrl: data.thumbnailUrl || null,
      },
    });

    await logAudit(
      session.user.id,
      "CREATE",
      "tiktok_template",
      created.id,
      `Tambah template TikTok: ${created.name}`,
    );

    return successResponse(created, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
