import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  requireAuth,
  ApiError,
  logAudit,
} from "@/lib/api-utils";

const createMediaSchema = z.object({
  filename: z.string().min(1),
  url: z.string().url(),
  type: z.string().min(1),
  size: z.number().int().min(0),
});

// GET /api/media — list all media, paginated
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const uploadedBy = searchParams.get("uploadedBy") || undefined;

    const where = uploadedBy ? { uploadedBy } : {};

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.media.count({ where }),
    ]);

    return successResponse({
      media,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/media — create media record
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const data = createMediaSchema.parse(body);

    const media = await prisma.media.create({
      data: {
        filename: data.filename,
        url: data.url,
        type: data.type,
        size: data.size,
        uploadedBy: session.user.id,
        uploaderName: session.user.name,
      },
    });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "MEDIA_CREATE", "Media", media.id, JSON.stringify({ filename: media.filename }), ip);

    return successResponse(media, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(new ApiError(error.errors[0].message, 400));
    }
    return errorResponse(error);
  }
}

// DELETE /api/media — delete media by id (query param)
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new ApiError("ID media diperlukan", 400);
    }

    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) {
      throw new ApiError("Media tidak ditemukan", 404);
    }

    // Only uploader or admin can delete
    const isAdmin = session.user.role === "SUPER_ADMIN";
    if (media.uploadedBy !== session.user.id && !isAdmin) {
      throw new ApiError("Anda tidak memiliki izin untuk menghapus media ini", 403);
    }

    await prisma.media.delete({ where: { id } });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "MEDIA_DELETE", "Media", id, JSON.stringify({ filename: media.filename }), ip);

    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
