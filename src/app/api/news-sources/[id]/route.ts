/**
 * GET    /api/news-sources/:id  — single (admin)
 * PUT    /api/news-sources/:id  — update (admin)
 * DELETE /api/news-sources/:id  — delete (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  ApiError,
  logAudit,
} from "@/lib/api-utils";
import { isAllowedByRobots } from "@/lib/scraper/robots-check";

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR"] as const;

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  listingUrl: z.string().url().optional(),
  categoryId: z.string().min(1).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  frequencyHours: z.number().int().min(1).max(24).optional(),
  articleSelector: z.string().max(500).optional().nullable(),
  titleSelector: z.string().max(500).optional().nullable(),
  contentSelector: z.string().max(500).optional().nullable(),
  imageSelector: z.string().max(500).optional().nullable(),
  useHeadless: z.boolean().optional(),
  waitForSelector: z.string().max(500).optional().nullable(),
  crawlSubcategories: z.boolean().optional(),
  crawlMaxPages: z.number().int().min(1).max(50).optional(),
  paginationMaxPages: z.number().int().min(1).max(30).optional(),
  paginationPattern: z.string().max(60).optional().nullable(),
  defaultTags: z.array(z.string().min(1).max(40)).max(10).optional(),
});

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    await requireRole([...ADMIN_ROLES]);
    const source = await prisma.newsSource.findUnique({
      where: { id: params.id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!source) throw new ApiError("Sumber tidak ditemukan", 404);
    return successResponse(source);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole([...ADMIN_ROLES]);
    const existing = await prisma.newsSource.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Sumber tidak ditemukan", 404);

    const data = updateSchema.parse(await request.json());

    if (data.listingUrl && data.listingUrl !== existing.listingUrl) {
      const allowed = await isAllowedByRobots(data.listingUrl);
      if (!allowed) {
        throw new ApiError(
          "URL baru diblok oleh robots.txt situs sumber.",
          400,
        );
      }
    }

    const updated = await prisma.newsSource.update({
      where: { id: params.id },
      data,
      include: { category: { select: { id: true, name: true, slug: true } } },
    });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "NEWS_SOURCE_UPDATE", "NewsSource", params.id, JSON.stringify({ name: updated.name }), ip);

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole([...ADMIN_ROLES]);
    const existing = await prisma.newsSource.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Sumber tidak ditemukan", 404);
    await prisma.newsSource.delete({ where: { id: params.id } });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "NEWS_SOURCE_DELETE", "NewsSource", params.id, JSON.stringify({ name: existing.name }), ip);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
