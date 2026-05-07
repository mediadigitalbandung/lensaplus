import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  getSession,
  ApiError,
} from "@/lib/api-utils";
import { commentRateLimit } from "@/lib/rate-limit";
import { sanitizeText, sanitizeEmail } from "@/lib/sanitize";
import { checkSpam } from "@/lib/spam-filter";

const createCommentSchema = z.object({
  authorName: z.string().min(2, "Nama minimal 2 karakter").max(100),
  authorEmail: z.string().email("Email tidak valid").transform((v) => v.toLowerCase()),
  content: z.string().min(3, "Komentar minimal 3 karakter").max(2000),
  parentId: z.string().optional(),
});

// GET /api/articles/:id/comments — public: approved only, admin/editor: all
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!article) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }

    // Check if user is admin/editor
    const session = await getSession();
    const role = session?.user?.role || "";
    const isEditorOrAdmin = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(role);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));

    const where = {
      articleId: params.id,
      ...(isEditorOrAdmin ? {} : { isApproved: true }),
    };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.comment.count({ where }),
    ]);

    return successResponse({ comments, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/articles/:id/comments — public, creates unapproved comment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const { success: allowed } = commentRateLimit(ip);
    if (!allowed) {
      throw new ApiError("Terlalu banyak komentar. Coba lagi dalam beberapa menit.", 429);
    }

    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });
    if (!article) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }
    if (article.status !== "PUBLISHED") {
      throw new ApiError("Komentar hanya bisa dikirim pada artikel yang sudah dipublikasi", 400);
    }

    const body = await request.json();
    const data = createCommentSchema.parse(body);

    const sanitizedAuthor = sanitizeText(data.authorName);
    const sanitizedEmail = sanitizeEmail(data.authorEmail);
    const sanitizedContent = sanitizeText(data.content);

    // Spam filter — heuristic + (optional) Akismet. Hard "spam" verdict
    // means we don't even persist it; "review" persists unapproved with
    // a note for the moderator; "ok" is the normal path.
    const spam = await checkSpam({
      content: sanitizedContent,
      authorName: sanitizedAuthor,
      authorEmail: sanitizedEmail,
      ip,
      userAgent: request.headers.get("user-agent") || undefined,
    });
    if (spam.verdict === "spam") {
      // Return success-shaped response so spam bots don't learn that we
      // rejected them — but record nothing.
      return successResponse(
        { id: null, isApproved: false, status: "filtered" },
        201,
      );
    }

    const comment = await prisma.comment.create({
      data: {
        authorName: sanitizedAuthor,
        authorEmail: sanitizedEmail,
        content: sanitizedContent,
        parentId: data.parentId || null,
        articleId: params.id,
        isApproved: false,
      },
    });

    return successResponse(comment, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(new ApiError(error.errors[0].message, 400));
    }
    return errorResponse(error);
  }
}
