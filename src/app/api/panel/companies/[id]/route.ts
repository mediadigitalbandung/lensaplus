/**
 * GET    /api/panel/companies/:id — detail (admin)
 * PUT    /api/panel/companies/:id — full update
 * DELETE /api/panel/companies/:id — delete
 *
 * Auth: EDITOR+
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse, logAudit, requireRole, successResponse } from "@/lib/api-utils";

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

const updateSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(10)
    .transform((v) => v.toUpperCase().trim())
    .optional(),
  name: z.string().min(1).max(500).optional(),
  shortName: z.string().max(100).optional().nullable(),
  sector: z.enum(SECTOR_VALUES).optional(),
  description: z.string().max(50000).optional().nullable(),
  founded: z.number().int().min(1800).max(2100).optional().nullable(),
  ipoDate: z.string().datetime().optional().nullable(),
  marketCap: z.number().int().min(0).optional().nullable(),
  website: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  ceo: z.string().max(300).optional().nullable(),
  hq: z.string().max(500).optional().nullable(),
  employees: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

function serializeCompany(c: Record<string, unknown>) {
  return { ...c, marketCap: c.marketCap !== null && c.marketCap !== undefined ? String(c.marketCap) : null };
}

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const company = await prismaAny.publicCompany.findUnique({ where: { id: params.id } });
    if (!company) throw new ApiError("Perusahaan tidak ditemukan", 404);

    return successResponse(serializeCompany(company as unknown as Record<string, unknown>));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const existing = await prismaAny.publicCompany.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Perusahaan tidak ditemukan", 404);

    const body = await req.json();
    const data = updateSchema.parse(body);

    const updated = await prismaAny.publicCompany.update({
      where: { id: params.id },
      data: {
        ...(data.ticker !== undefined && { ticker: data.ticker }),
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.shortName !== undefined && { shortName: data.shortName?.trim() ?? null }),
        ...(data.sector !== undefined && { sector: data.sector }),
        ...(data.description !== undefined && { description: data.description?.trim() ?? null }),
        ...(data.founded !== undefined && { founded: data.founded }),
        ...(data.ipoDate !== undefined && {
          ipoDate: data.ipoDate ? new Date(data.ipoDate) : null,
        }),
        ...(data.marketCap !== undefined && {
          marketCap: data.marketCap !== null ? BigInt(data.marketCap) : null,
        }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
        ...(data.ceo !== undefined && { ceo: data.ceo?.trim() ?? null }),
        ...(data.hq !== undefined && { hq: data.hq?.trim() ?? null }),
        ...(data.employees !== undefined && { employees: data.employees }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    await logAudit(
      session.user.id,
      "COMPANY_UPDATE",
      "PublicCompany",
      params.id,
      `Updated ${updated.ticker} — ${updated.name}`
    );

    return successResponse(serializeCompany(updated as unknown as Record<string, unknown>));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const existing = await prismaAny.publicCompany.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Perusahaan tidak ditemukan", 404);

    await prismaAny.publicCompany.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "COMPANY_DELETE",
      "PublicCompany",
      params.id,
      `Deleted ${existing.ticker} — ${existing.name}`
    );

    return successResponse({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
