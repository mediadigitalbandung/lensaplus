import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse, requireRole, requireAuth, ApiError } from "@/lib/api-utils";
import { reportRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

const updateReportSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"]),
});

const createReportSchema = z.object({
  articleId: z.string().min(1),
  reason: z.enum(["HOAX", "INACCURATE", "SARA", "DEFAMATION", "OTHER"]),
  detail: z.string().max(1000).optional(),
  email: z.string().email().optional(),
});

// GET /api/reports — editors see all, creators see only their articles' reports
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const role = session.user.role;
    const isEditor = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(role);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (status && ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"].includes(status)) {
      where.status = status;
    }
    // Non-editors can only see reports on their own articles
    if (!isEditor) {
      where.article = { authorId: session.user.id };
    }

    const [reports, total, pendingCount] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          article: {
            select: { id: true, title: true, slug: true, author: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.report.count({ where }),
      prisma.report.count({ where: { status: "PENDING" } }),
    ]);

    return successResponse({
      reports,
      total,
      pendingCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/reports — update report status (editor+)
export async function PATCH(request: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const body = await request.json();
    const data = updateReportSchema.parse(body);

    const existing = await prisma.report.findUnique({ where: { id: data.id } });
    if (!existing) {
      throw new ApiError("Laporan tidak ditemukan", 404);
    }

    const report = await prisma.report.update({
      where: { id: data.id },
      data: { status: data.status },
    });

    return successResponse(report);
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/reports — public
export async function POST(request: NextRequest) {
  try {
    // Rate limit report submissions
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { success: allowed } = reportRateLimit(ip);
    if (!allowed) {
      throw new ApiError("Terlalu banyak laporan. Coba lagi nanti.", 429);
    }

    const body = await request.json();
    const data = createReportSchema.parse(body);

    // Sanitize free-text detail field — strip HTML/angle brackets before storing
    if (data.detail) {
      data.detail = sanitizeText(data.detail);
    }

    const article = await prisma.article.findUnique({ where: { id: data.articleId } });
    if (!article) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }

    const report = await prisma.report.create({ data });

    return successResponse(report, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
