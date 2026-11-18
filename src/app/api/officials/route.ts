/**
 * GET /api/officials — public listing with filter & pagination
 *
 * Query params:
 *   level   — OfficialLevel enum value
 *   region  — string (partial match)
 *   status  — OfficialStatus enum value (default: no filter)
 *   search  — string (matches name, position, institution)
 *   page    — integer (default 1)
 *   limit   — integer (default 20, max 100)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse, parsePositiveInt } from "@/lib/api-utils";
import { guardPublicRead } from "@/lib/rate-limit";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_LEVELS = new Set([
  "NASIONAL",
  "PROVINSI",
  "KOTA_KABUPATEN",
  "KECAMATAN",
  "YUDIKATIF",
  "LEMBAGA",
  "OTHER",
]);

const VALID_STATUSES = new Set(["AKTIF", "PURNA", "CUTI", "NONAKTIF"]);

export async function GET(req: NextRequest) {
  const blocked = guardPublicRead(req);
  if (blocked) return blocked;
  try {
    const { searchParams } = new URL(req.url);

    const limit = parsePositiveInt(searchParams.get("limit"), 20, 100);
    const page = parsePositiveInt(searchParams.get("page"), 1);

    const levelParam = searchParams.get("level");
    const regionParam = searchParams.get("region");
    const statusParam = searchParams.get("status");
    const searchParam = searchParams.get("search");

    const where: Prisma.PublicOfficialWhereInput = {
      isPublished: true,
      ...(levelParam && VALID_LEVELS.has(levelParam)
        ? { level: levelParam as Prisma.EnumOfficialLevelFilter }
        : {}),
      ...(statusParam && VALID_STATUSES.has(statusParam)
        ? { status: statusParam as Prisma.EnumOfficialStatusFilter }
        : {}),
      ...(regionParam
        ? { region: { contains: regionParam, mode: "insensitive" } }
        : {}),
      ...(searchParam
        ? {
            OR: [
              { name: { contains: searchParam, mode: "insensitive" } },
              { position: { contains: searchParam, mode: "insensitive" } },
              { institution: { contains: searchParam, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [officials, total] = await Promise.all([
      prisma.publicOfficial.findMany({
        where,
        select: {
          id: true,
          slug: true,
          name: true,
          position: true,
          institution: true,
          level: true,
          region: true,
          status: true,
          party: true,
          photoUrl: true,
          termStart: true,
          termEnd: true,
          viewCount: true,
        },
        orderBy: [{ level: "asc" }, { name: "asc" }],
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.publicOfficial.count({ where }),
    ]);

    return successResponse({
      officials,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
