/**
 * GET  /api/news-sources       — list (admin only)
 * POST /api/news-sources       — create (admin only)
 *
 * Validates the supplied listingUrl is reachable and not blocked by
 * robots.txt. Frequency is clamped to 1–24 hours.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  ApiError,
} from "@/lib/api-utils";
import { isAllowedByRobots } from "@/lib/scraper/robots-check";

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR"] as const;

const createSchema = z.object({
  name: z.string().min(2).max(120),
  listingUrl: z.string().url(),
  categoryId: z.string().min(1).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  frequencyHours: z.number().int().min(1).max(24).optional(),
  articleSelector: z.string().max(500).optional().nullable(),
  titleSelector: z.string().max(500).optional().nullable(),
  contentSelector: z.string().max(500).optional().nullable(),
  imageSelector: z.string().max(500).optional().nullable(),
  defaultTags: z.array(z.string().min(1).max(40)).max(10).optional(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole([...ADMIN_ROLES]);
    const sources = await prisma.newsSource.findMany({
      orderBy: [{ isActive: "desc" }, { priority: "desc" }, { name: "asc" }],
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    return successResponse({ sources });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole([...ADMIN_ROLES]);
    const body = await request.json();
    const data = createSchema.parse(body);

    // robots.txt check — block if upstream forbids us.
    const allowed = await isAllowedByRobots(data.listingUrl);
    if (!allowed) {
      throw new ApiError(
        `URL diblok oleh robots.txt situs sumber. Jangan digunakan untuk menghormati ToS upstream.`,
        400,
      );
    }

    const created = await prisma.newsSource.create({
      data: {
        name: data.name,
        listingUrl: data.listingUrl,
        categoryId: data.categoryId || null,
        description: data.description || null,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
        frequencyHours: data.frequencyHours ?? 4,
        articleSelector: data.articleSelector || null,
        titleSelector: data.titleSelector || null,
        contentSelector: data.contentSelector || null,
        imageSelector: data.imageSelector || null,
        defaultTags: data.defaultTags ?? [],
      },
    });
    return successResponse(created, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
