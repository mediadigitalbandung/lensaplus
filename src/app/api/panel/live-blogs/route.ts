/**
 * GET  /api/panel/live-blogs — admin listing (all statuses)
 * POST /api/panel/live-blogs — create new live blog
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR | JOURNALIST
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
  ApiError,
} from "@/lib/api-utils";
import { sanitizeText } from "@/lib/sanitize";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const WRITE_ROLES = [
  "SUPER_ADMIN",
  "CHIEF_EDITOR",
  "EDITOR",
  "JOURNALIST",
] as const;

const createSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter").max(300),
  slug: z
    .string()
    .min(3)
    .max(150)
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda -"),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  status: z
    .enum(["SCHEDULED", "LIVE", "ENDED", "CANCELLED"])
    .default("SCHEDULED"),
  scheduledAt: z.string().datetime(),
  startedAt: z.string().datetime().optional().nullable(),
  endedAt: z.string().datetime().optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  articleId: z.string().optional().nullable(),
  isPublished: z.boolean().default(true),
  syndicateToSocial: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole([...WRITE_ROLES]);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const statusFilter = searchParams.get("status");

    const VALID_STATUSES = new Set([
      "SCHEDULED",
      "LIVE",
      "ENDED",
      "CANCELLED",
    ]);

    const where: Prisma.LiveBlogWhereInput = {};
    if (statusFilter && VALID_STATUSES.has(statusFilter)) {
      where.status =
        statusFilter as Prisma.EnumLiveBlogStatusFilter;
    }

    const [liveBlogs, total] = await Promise.all([
      prisma.liveBlog.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          category: true,
          status: true,
          scheduledAt: true,
          startedAt: true,
          endedAt: true,
          isPublished: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { entries: true } },
          author: { select: { id: true, name: true } },
        },
        orderBy: { scheduledAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.liveBlog.count({ where }),
    ]);

    return successResponse({
      liveBlogs,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole([...WRITE_ROLES]);

    const body = await req.json();
    const data = createSchema.parse(body);

    // Check slug uniqueness
    const existing = await prisma.liveBlog.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ApiError("Slug sudah digunakan, pilih slug lain", 409);
    }

    const liveBlog = await prisma.liveBlog.create({
      data: {
        slug: data.slug,
        title: sanitizeText(data.title),
        description: data.description ?? null,
        category: data.category ? sanitizeText(data.category) : null,
        status: data.status,
        scheduledAt: new Date(data.scheduledAt),
        startedAt: data.startedAt ? new Date(data.startedAt) : null,
        endedAt: data.endedAt ? new Date(data.endedAt) : null,
        coverImage: data.coverImage ?? null,
        authorId: session.user.id,
        articleId: data.articleId ?? null,
        isPublished: data.isPublished,
        syndicateToSocial: data.syndicateToSocial,
      },
    });

    await logAudit(
      session.user.id,
      "LIVE_BLOG_CREATE",
      "LiveBlog",
      liveBlog.id,
      `Created live blog: ${liveBlog.title} [status: ${liveBlog.status}]`
    );

    return successResponse(liveBlog, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
