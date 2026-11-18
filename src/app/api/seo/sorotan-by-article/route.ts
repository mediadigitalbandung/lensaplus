/**
 * GET /api/seo/sorotan-by-article?page=&limit=&search=&filter=&articleStatus=&indexStatus=&scope=
 *
 * Article-centric Sorotan listing for the panel: non-archived articles, each
 * with the list of its Sorotan angle-pages (slug + angle + title + indexStatus)
 * so the panel can display a status table showing which articles already have
 * Sorotan vs. which do not yet, and let editors inspect or generate them.
 *
 *   filter=all                      → all non-archived articles
 *   filter=with                     → only articles that already have ≥1 Sorotan
 *   filter=without                  → only articles without any Sorotan yet
 *   onlyWithSorotan=true|false      → legacy fallback when `filter` is omitted
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 */

import { NextRequest } from "next/server";
import { ArticleStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireRole,
  successResponse,
  errorResponse,
  parsePositiveInt,
} from "@/lib/api-utils";
import { SOROTAN_ANGLE_COUNT } from "@/lib/seo/sorotan-constants";
import { getInFlightSorotanArticleIds } from "@/lib/seo/sorotan-generator";

export const dynamic = "force-dynamic";

type SorotanFilter = "all" | "with" | "without";

const VALID_ARTICLE_STATUSES = new Set<ArticleStatus>([
  "PUBLISHED",
  "IN_REVIEW",
  "APPROVED",
  "DRAFT",
  "REJECTED",
]);

const VALID_INDEX_STATUSES = new Set([
  "failed",
  "pending",
  "submitted",
  "indexed",
]);

function resolveSorotanFilter(searchParams: URLSearchParams): SorotanFilter {
  const filterParam = (searchParams.get("filter") || "").toLowerCase();
  if (
    filterParam === "all" ||
    filterParam === "with" ||
    filterParam === "without"
  ) {
    return filterParam;
  }
  // Legacy fallback: default to "with" when `onlyWithSorotan` is omitted or !== "false"
  return searchParams.get("onlyWithSorotan") === "false" ? "all" : "with";
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(searchParams.get("limit"), 15, 50);
    const search = (searchParams.get("search") || "").trim();
    const scope = searchParams.get("scope") === "me" ? "me" : "all";
    const sorotanFilter = resolveSorotanFilter(searchParams);

    const rawArticleStatus = (searchParams.get("articleStatus") || "").toUpperCase();
    const validArticleStatus = VALID_ARTICLE_STATUSES.has(
      rawArticleStatus as ArticleStatus,
    )
      ? (rawArticleStatus as ArticleStatus)
      : null;

    const rawIndexStatus = (searchParams.get("indexStatus") || "").toLowerCase();
    const validIndexStatus = VALID_INDEX_STATUSES.has(rawIndexStatus)
      ? rawIndexStatus
      : null;

    const baseScopeWhere: Prisma.ArticleWhereInput = {
      status: { not: "ARCHIVED" },
      ...(scope === "me" ? { authorId: session.user.id } : {}),
    };

    const filterBaseWhere: Prisma.ArticleWhereInput = {
      ...baseScopeWhere,
      ...(validArticleStatus ? { status: validArticleStatus } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(validIndexStatus
        ? { sorotan: { some: { indexStatus: validIndexStatus } } }
        : {}),
    };

    let where: Prisma.ArticleWhereInput = filterBaseWhere;
    if (sorotanFilter === "with" && !validIndexStatus) {
      where = { ...filterBaseWhere, sorotan: { some: {} } };
    } else if (sorotanFilter === "without") {
      where = validIndexStatus
        ? { AND: [filterBaseWhere, { sorotan: { none: {} } }] }
        : { ...filterBaseWhere, sorotan: { none: {} } };
    }

    const hasExtraFilters = Boolean(
      validArticleStatus || search || validIndexStatus,
    );

    const [
      articles,
      total,
      summaryTotalArticles,
      summaryWithSorotan,
      totalSorotan,
      tabAllRaw,
      tabWithRaw,
    ] = await Promise.all([
      prisma.article.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          createdAt: true,
          publishedAt: true,
          category: { select: { name: true, slug: true } },
          author: { select: { id: true, name: true } },
          sorotan: {
            select: {
              slug: true,
              angle: true,
              title: true,
              indexStatus: true,
              createdAt: true,
            },
            orderBy: { angle: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.article.count({ where }),
      prisma.article.count({ where: baseScopeWhere }),
      prisma.article.count({
        where: { ...baseScopeWhere, sorotan: { some: {} } },
      }),
      prisma.sorotan.count({
        where: { article: baseScopeWhere },
      }),
      hasExtraFilters
        ? prisma.article.count({ where: filterBaseWhere })
        : Promise.resolve(null),
      hasExtraFilters && !validIndexStatus
        ? prisma.article.count({
            where: { ...filterBaseWhere, sorotan: { some: {} } },
          })
        : Promise.resolve(null),
    ]);

    const summaryWithoutSorotan = Math.max(
      0,
      summaryTotalArticles - summaryWithSorotan,
    );
    const tabAll = tabAllRaw ?? summaryTotalArticles;
    const tabWith = validIndexStatus
      ? tabAll
      : (tabWithRaw ?? summaryWithSorotan);
    const tabWithout = validIndexStatus ? 0 : Math.max(0, tabAll - tabWith);

    return successResponse({
      articles,
      totalSorotan,
      inFlightArticleIds: getInFlightSorotanArticleIds(),
      summary: {
        totalArticles: summaryTotalArticles,
        withSorotanCount: summaryWithSorotan,
        withoutSorotanCount: summaryWithoutSorotan,
        totalSorotan,
        targetAngles: SOROTAN_ANGLE_COUNT,
      },
      tabCounts: {
        all: tabAll,
        with: tabWith,
        without: tabWithout,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
