/**
 * GET    /api/news-sources/:id  — single (admin)
 * PUT    /api/news-sources/:id  — update (admin)
 * DELETE /api/news-sources/:id  — delete (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  ApiError,
  logAudit,
} from "@/lib/api-utils";
import { isAllowedByRobots } from "@/lib/scraper/robots-check";
import { assertSafePublicUrl } from "@/lib/scraper/fetch";
import {
  newsSourceUpdateSchema,
  assertCategoryExists,
} from "@/lib/scraper/source-validation";
import { SCRAPER_ROLES } from "@/lib/roles";
import { canPublishDirectly } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit";

/** A source is manageable by its owner, or by any SUPER_ADMIN. */
function canManageSource(
  session: { user: { id: string; role: string } },
  source: { ownerId: string | null },
): boolean {
  return session.user.role === "SUPER_ADMIN" || source.ownerId === session.user.id;
}

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole([...SCRAPER_ROLES]);
    const source = await prisma.newsSource.findUnique({
      where: { id: params.id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!source || !canManageSource(session, source)) {
      throw new ApiError("Sumber tidak ditemukan", 404);
    }
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
    const session = await requireRole([...SCRAPER_ROLES]);
    const existing = await prisma.newsSource.findUnique({
      where: { id: params.id },
    });
    if (!existing || !canManageSource(session, existing)) {
      throw new ApiError("Sumber tidak ditemukan", 404);
    }

    const data = newsSourceUpdateSchema.parse(await request.json());

    if (data.categoryId !== undefined) {
      await assertCategoryExists(data.categoryId);
    }

    if (data.listingUrl && data.listingUrl !== existing.listingUrl) {
      try {
        await assertSafePublicUrl(data.listingUrl);
      } catch {
        throw new ApiError("URL baru tidak diizinkan (host privat atau tidak valid).", 400);
      }
      const allowed = await isAllowedByRobots(data.listingUrl);
      if (!allowed) {
        throw new ApiError(
          "URL baru diblok oleh robots.txt situs sumber.",
          400,
        );
      }
      // Per-owner uniqueness on the new URL.
      const dup = await prisma.newsSource.findFirst({
        where: {
          ownerId: existing.ownerId,
          listingUrl: data.listingUrl,
          id: { not: existing.id },
        },
        select: { id: true },
      });
      if (dup) throw new ApiError("Sumber dengan URL ini sudah ada.", 409);
    }

    const safeData = canPublishDirectly(session.user.role)
      ? data
      : { ...data, autoPublish: false };

    const updated = await prisma.newsSource.update({
      where: { id: params.id },
      data: safeData,
      include: { category: { select: { id: true, name: true, slug: true } } },
    });

    const ip = getClientIp(request);
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
    const session = await requireRole([...SCRAPER_ROLES]);
    const existing = await prisma.newsSource.findUnique({
      where: { id: params.id },
    });
    if (!existing || !canManageSource(session, existing)) {
      throw new ApiError("Sumber tidak ditemukan", 404);
    }
    await prisma.newsSource.delete({ where: { id: params.id } });

    const ip = getClientIp(request);
    await logAudit(session.user.id, "NEWS_SOURCE_DELETE", "NewsSource", params.id, JSON.stringify({ name: existing.name }), ip);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
