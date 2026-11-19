/**
 * GET  /api/news-sources       — list (admin only)
 * POST /api/news-sources       — create (admin only)
 *
 * Validates the supplied listingUrl is reachable and not blocked by
 * robots.txt. Frequency is clamped to 1–24 hours.
 */

import { NextRequest } from "next/server";
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
  newsSourceCreateSchema,
  assertCategoryExists,
} from "@/lib/scraper/source-validation";
import { SCRAPER_ROLES } from "@/lib/roles";
import { canPublishDirectly } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Any writer may browse — but only their OWN sources. SUPER_ADMIN sees
    // everyone's (with the owner attached so the panel can label who scrapes).
    const session = await requireRole([...SCRAPER_ROLES]);
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    const sources = await prisma.newsSource.findMany({
      where: isSuperAdmin ? {} : { ownerId: session.user.id },
      orderBy: [{ isActive: "desc" }, { priority: "desc" }, { name: "asc" }],
      include: {
        category: { select: { id: true, name: true, slug: true } },
        owner: { select: { id: true, name: true } },
      },
    });
    return successResponse({ sources });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Every writer may add their OWN sources to scrape.
    const session = await requireRole([...SCRAPER_ROLES]);
    const body = await request.json();
    const data = newsSourceCreateSchema.parse(body);

    await assertCategoryExists(data.categoryId);

    // SSRF guard before any network call (including robots.txt fetch)
    try {
      await assertSafePublicUrl(data.listingUrl);
    } catch {
      throw new ApiError("URL sumber tidak diizinkan (host privat atau tidak valid).", 400);
    }

    // robots.txt check — block if upstream forbids us.
    const allowed = await isAllowedByRobots(data.listingUrl);
    if (!allowed) {
      throw new ApiError(
        `URL diblok oleh robots.txt situs sumber. Jangan digunakan untuk menghormati ToS upstream.`,
        400,
      );
    }

    // Per-owner uniqueness: reject if THIS user already has the same URL.
    const dup = await prisma.newsSource.findFirst({
      where: { ownerId: session.user.id, listingUrl: data.listingUrl },
      select: { id: true },
    });
    if (dup) {
      throw new ApiError("Anda sudah punya sumber dengan URL ini.", 409);
    }

    const created = await prisma.newsSource.create({
      data: {
        name: data.name,
        listingUrl: data.listingUrl,
        ownerId: session.user.id,
        categoryId: data.categoryId || null,
        description: data.description || null,
        isActive: data.isActive ?? true,
        autoScrape: data.autoScrape ?? true,
        autoPublish: canPublishDirectly(session.user.role)
          ? (data.autoPublish ?? false)
          : false,
        priority: data.priority ?? 0,
        frequencyHours: data.frequencyHours ?? 1,
        articleSelector: data.articleSelector || null,
        titleSelector: data.titleSelector || null,
        contentSelector: data.contentSelector || null,
        imageSelector: data.imageSelector || null,
        useHeadless: data.useHeadless ?? false,
        waitForSelector: data.waitForSelector || null,
        crawlSubcategories: data.crawlSubcategories ?? false,
        crawlMaxPages: data.crawlMaxPages ?? 8,
        paginationMaxPages: data.paginationMaxPages ?? 1,
        paginationPattern: data.paginationPattern || null,
        defaultTags: data.defaultTags ?? [],
      },
    });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "NEWS_SOURCE_CREATE", "NewsSource", created.id, JSON.stringify({ name: created.name, listingUrl: created.listingUrl }), ip);

    return successResponse(created, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
