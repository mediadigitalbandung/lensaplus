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
import {
  TIKTOK_CAPTION_MAX,
  TIKTOK_TITLE_MAX,
  canManageTiktok,
  normalizeHashtags,
} from "@/lib/tiktok/specs";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(TIKTOK_TITLE_MAX),
  caption: z.string().max(TIKTOK_CAPTION_MAX).optional().nullable(),
  hashtags: z.string().optional().default(""),
  accountId: z.string().optional().nullable(),
  templateKey: z.string().optional().nullable(),
  aspectRatio: z.enum(["PORTRAIT_9_16", "SQUARE_1_1"]).optional(),
  sourceArticleId: z.string().optional().nullable(),
});

// GET /api/tiktok/contents
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) {
      throw new ApiError("Forbidden", 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const accountId = searchParams.get("accountId");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (accountId) where.accountId = accountId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { caption: { contains: search, mode: "insensitive" } },
      ];
    }
    // Each account sees only its OWN TikTok content; SUPER_ADMIN sees all.
    if (session.user.role !== "SUPER_ADMIN") where.createdById = session.user.id;

    const [contents, total] = await Promise.all([
      prisma.tiktokContent.findMany({
        where,
        include: {
          account: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          slots: { select: { id: true, kind: true, url: true, order: true }, orderBy: { order: "asc" } },
          _count: { select: { slots: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tiktokContent.count({ where }),
    ]);

    return successResponse({
      contents,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/tiktok/contents
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) {
      throw new ApiError("Forbidden", 403);
    }

    const body = await request.json();
    const data = createSchema.parse(body);

    if (data.accountId) {
      const acct = await prisma.tiktokAccount.findUnique({ where: { id: data.accountId } });
      if (!acct) throw new ApiError("Akun TikTok tidak ditemukan", 404);
    }

    const created = await prisma.tiktokContent.create({
      data: {
        title: data.title,
        caption: data.caption?.trim() || null,
        hashtags: normalizeHashtags(data.hashtags || ""),
        accountId: data.accountId || null,
        templateKey: data.templateKey || null,
        aspectRatio: data.aspectRatio || "PORTRAIT_9_16",
        sourceArticleId: data.sourceArticleId || null,
        createdById: session.user.id,
        createdByName: session.user.name,
      },
    });

    await logAudit(
      session.user.id,
      "CREATE",
      "tiktok_content",
      created.id,
      `Membuat konten TikTok: ${created.title}`,
    );

    return successResponse(created, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
