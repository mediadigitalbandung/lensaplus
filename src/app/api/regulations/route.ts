/**
 * GET /api/regulations — public listing with filter & pagination
 *
 * Query params:
 *   type   — RegulationType enum value
 *   year   — integer
 *   topic  — string (partial match)
 *   search — string (matches title, shortTitle, number)
 *   status — RegulationStatus enum value
 *   page   — integer (default 1)
 *   limit  — integer (default 20, max 100)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse, parsePositiveInt } from "@/lib/api-utils";
import { guardPublicRead } from "@/lib/rate-limit";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set([
  "UU",
  "PERPPU",
  "PP",
  "PERPRES",
  "KEPPRES",
  "INPRES",
  "PERMEN",
  "KEPMEN",
  "PERDA_PROV",
  "PERDA_KAB",
  "PERGUB",
  "PERWAL",
  "PUTUSAN_MK",
  "PUTUSAN_MA",
  "OTHER",
]);

const VALID_STATUSES = new Set([
  "DRAFT_RUU",
  "ENACTED",
  "AMENDED",
  "REVOKED",
]);

export async function GET(req: NextRequest) {
  const blocked = guardPublicRead(req);
  if (blocked) return blocked;
  try {
    const { searchParams } = new URL(req.url);

    const limit = parsePositiveInt(searchParams.get("limit"), 20, 100);
    const page = parsePositiveInt(searchParams.get("page"), 1);

    const typeParam = searchParams.get("type");
    const yearParam = searchParams.get("year")?.trim();
    const topicParam = searchParams.get("topic");
    const searchParam = searchParams.get("search");
    const statusParam = searchParams.get("status");
    const parsedYear = yearParam && /^\d{4}$/.test(yearParam) ? Number.parseInt(yearParam, 10) : null;

    const where: Prisma.RegulationWhereInput = {
      isPublished: true,
      ...(typeParam && VALID_TYPES.has(typeParam)
        ? { type: typeParam as Prisma.EnumRegulationTypeFilter }
        : {}),
      ...(parsedYear !== null
        ? { year: parsedYear }
        : {}),
      ...(statusParam && VALID_STATUSES.has(statusParam)
        ? { status: statusParam as Prisma.EnumRegulationStatusFilter }
        : {}),
      ...(topicParam
        ? { topic: { contains: topicParam, mode: "insensitive" } }
        : {}),
      ...(searchParam
        ? {
            OR: [
              { title: { contains: searchParam, mode: "insensitive" } },
              { shortTitle: { contains: searchParam, mode: "insensitive" } },
              { number: { contains: searchParam, mode: "insensitive" } },
              { topic: { contains: searchParam, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [regulations, total] = await Promise.all([
      prisma.regulation.findMany({
        where,
        select: {
          id: true,
          type: true,
          number: true,
          year: true,
          title: true,
          shortTitle: true,
          topic: true,
          status: true,
          enactedAt: true,
          effectiveAt: true,
          issuedBy: true,
          sourceUrl: true,
          pdfUrl: true,
          viewCount: true,
        },
        orderBy: [{ enactedAt: "desc" }, { year: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.regulation.count({ where }),
    ]);

    return successResponse({
      regulations,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
