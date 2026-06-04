/**
 * GET /api/seo/sorotan-by-article?page=&limit=&search=&onlyWithSorotan=
 *
 * Article-centric Sorotan listing for the panel: published articles, each with
 * the list of its Sorotan angle-pages (slug + angle + title) so the panel can
 * show the source article and let the user jump to any of its Sorotan pages.
 *
 *   onlyWithSorotan=true (default) → only articles that already have ≥1 Sorotan
 *   onlyWithSorotan=false          → every published article (to generate for)
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, successResponse, errorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const search = (searchParams.get("search") || "").trim();
    // Default: only show articles that already have Sorotan (the browse case).
    const onlyWithSorotan = searchParams.get("onlyWithSorotan") !== "false";
    // scope=me → only articles the requester authored ("Sorotan Saya" tab).
    const scope = searchParams.get("scope");

    const where: Record<string, unknown> = { status: "PUBLISHED" };
    if (scope === "me") where.authorId = session.user.id;
    if (onlyWithSorotan) where.sorotan = { some: {} };
    if (search) where.title = { contains: search, mode: "insensitive" };

    const [articles, total, totalSorotan] = await Promise.all([
      prisma.article.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          publishedAt: true,
          sorotan: {
            select: { slug: true, angle: true, title: true },
            orderBy: { angle: "asc" },
          },
        },
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.article.count({ where }),
      prisma.sorotan.count(
        scope === "me"
          ? { where: { article: { authorId: session.user.id } } }
          : undefined,
      ),
    ]);

    return successResponse({
      articles,
      totalSorotan,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
