/**
 * GET /api/companies — public listing of PublicCompany
 * Query params: sector, search, page, limit
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-utils";
import { guardPublicRead } from "@/lib/rate-limit";

type CompanySector =
  | "KEUANGAN" | "ENERGI" | "KONSUMER" | "PROPERTI" | "TELEKOMUNIKASI"
  | "INFRASTRUKTUR" | "PERTAMBANGAN" | "PERTANIAN_PERKEBUNAN" | "TRANSPORTASI"
  | "TEKNOLOGI" | "KESEHATAN_FARMASI" | "MANUFAKTUR" | "PARIWISATA" | "OTHER";

export const dynamic = "force-dynamic";

const VALID_SECTORS = new Set<string>([
  "KEUANGAN",
  "ENERGI",
  "KONSUMER",
  "PROPERTI",
  "TELEKOMUNIKASI",
  "INFRASTRUKTUR",
  "PERTAMBANGAN",
  "PERTANIAN_PERKEBUNAN",
  "TRANSPORTASI",
  "TEKNOLOGI",
  "KESEHATAN_FARMASI",
  "MANUFAKTUR",
  "PARIWISATA",
  "OTHER",
]);

export async function GET(req: NextRequest) {
  const blocked = guardPublicRead(req);
  if (blocked) return blocked;
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "24", 10)));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const sectorParam = searchParams.get("sector");
    const search = searchParams.get("search");

    const where = {
      isActive: true,
      ...(sectorParam && VALID_SECTORS.has(sectorParam)
        ? { sector: sectorParam as CompanySector }
        : {}),
      ...(search
        ? {
            OR: [
              { ticker: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { shortName: { contains: search, mode: "insensitive" } },
              { hq: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = prisma as any;
    const [companies, total] = await Promise.all([
      prismaAny.publicCompany.findMany({
        where,
        orderBy: [{ marketCap: "desc" }, { name: "asc" }],
        take: limit,
        skip: (page - 1) * limit,
        select: {
          id: true,
          ticker: true,
          name: true,
          shortName: true,
          sector: true,
          marketCap: true,
          logoUrl: true,
          hq: true,
          isActive: true,
          viewCount: true,
        },
      }),
      prismaAny.publicCompany.count({ where }),
    ]);

    // BigInt (marketCap) tidak bisa JSON.stringify — convert ke string per row.
    const companiesSerialized = (companies as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      marketCap: c.marketCap === null || c.marketCap === undefined
        ? null
        : String(c.marketCap),
    }));

    return successResponse({
      companies: companiesSerialized,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
