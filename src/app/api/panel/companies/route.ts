/**
 * GET  /api/panel/companies — admin listing (paginated, filterable)
 * POST /api/panel/companies — create new PublicCompany
 *
 * Auth: EDITOR+
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, logAudit, requireRole, successResponse } from "@/lib/api-utils";

type CompanySector =
  | "KEUANGAN" | "ENERGI" | "KONSUMER" | "PROPERTI" | "TELEKOMUNIKASI"
  | "INFRASTRUKTUR" | "PERTAMBANGAN" | "PERTANIAN_PERKEBUNAN" | "TRANSPORTASI"
  | "TEKNOLOGI" | "KESEHATAN_FARMASI" | "MANUFAKTUR" | "PARIWISATA" | "OTHER";

export const dynamic = "force-dynamic";

const SECTOR_VALUES = [
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
] as const;

const createSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(10)
    .transform((v) => v.toUpperCase().trim()),
  name: z.string().min(1).max(500),
  shortName: z.string().max(100).optional().nullable(),
  sector: z.enum(SECTOR_VALUES),
  description: z.string().max(50000).optional().nullable(),
  founded: z.number().int().min(1800).max(2100).optional().nullable(),
  ipoDate: z.string().datetime().optional().nullable(),
  marketCap: z.number().int().min(0).optional().nullable(),
  website: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  ceo: z.string().max(300).optional().nullable(),
  hq: z.string().max(500).optional().nullable(),
  employees: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const sectorParam = searchParams.get("sector");
    const search = searchParams.get("search");
    const activeParam = searchParams.get("active");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = prisma as any;
    const where = {
      ...(sectorParam ? { sector: sectorParam as CompanySector } : {}),
      ...(activeParam !== null ? { isActive: activeParam === "true" } : {}),
      ...(search
        ? {
            OR: [
              { ticker: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { shortName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [companies, total] = await Promise.all([
      prismaAny.publicCompany.findMany({
        where,
        orderBy: [{ ticker: "asc" }],
        take: limit,
        skip: (page - 1) * limit,
      }),
      prismaAny.publicCompany.count({ where }),
    ]);

    return successResponse({
      companies,
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
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json();
    const data = createSchema.parse(body);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny2 = prisma as any;
    const company = await prismaAny2.publicCompany.create({
      data: {
        ticker: data.ticker,
        name: data.name.trim(),
        shortName: data.shortName?.trim() ?? null,
        sector: data.sector,
        description: data.description?.trim() ?? null,
        founded: data.founded ?? null,
        ipoDate: data.ipoDate ? new Date(data.ipoDate) : null,
        marketCap: data.marketCap !== null && data.marketCap !== undefined
          ? BigInt(data.marketCap)
          : null,
        website: data.website ?? null,
        logoUrl: data.logoUrl ?? null,
        ceo: data.ceo?.trim() ?? null,
        hq: data.hq?.trim() ?? null,
        employees: data.employees ?? null,
        isActive: data.isActive,
      },
    });

    await logAudit(
      session.user.id,
      "COMPANY_CREATE",
      "PublicCompany",
      company.id,
      `Created ${company.ticker} — ${company.name}`
    );

    return successResponse(
      { ...company, marketCap: company.marketCap?.toString() ?? null },
      201
    );
  } catch (err) {
    return errorResponse(err);
  }
}
