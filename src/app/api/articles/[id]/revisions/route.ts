import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireAuth,
  ApiError,
} from "@/lib/api-utils";
import { canViewAllArticles } from "@/lib/auth";

// GET /api/articles/:id/revisions
export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const session = await requireAuth();

    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true, authorId: true, reviewedBy: true, assignedEditorId: true },
    });

    if (!article) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }

    // Same scope as the article itself: only SUPER_ADMIN, the author, the
    // assigned editor or the reviewer may read its revision history.
    const uid = session.user.id;
    const canSee =
      canViewAllArticles(session.user.role) ||
      article.authorId === uid ||
      article.reviewedBy === uid ||
      article.assignedEditorId === uid;
    if (!canSee) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

    const [revisions, total] = await Promise.all([
      prisma.revision.findMany({
        where: { articleId: params.id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.revision.count({ where: { articleId: params.id } }),
    ]);

    return successResponse({ revisions, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return errorResponse(error);
  }
}
