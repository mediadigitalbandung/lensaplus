/**
 * GET    /api/panel/regulations/:id — detail (admin)
 * PUT    /api/panel/regulations/:id — full update
 * DELETE /api/panel/regulations/:id — delete
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  type: z
    .enum([
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
    ])
    .optional(),
  number: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1945).max(2100).optional(),
  title: z.string().min(1).max(2000).optional(),
  shortTitle: z.string().max(200).optional().nullable(),
  topic: z.string().max(200).optional().nullable(),
  description: z.string().max(20000).optional().nullable(),
  enactedAt: z.string().datetime().optional().nullable(),
  effectiveAt: z.string().datetime().optional().nullable(),
  issuedBy: z.string().max(300).optional().nullable(),
  status: z.enum(["DRAFT_RUU", "ENACTED", "AMENDED", "REVOKED"]).optional(),
  sourceUrl: z.string().url().optional().nullable(),
  pdfUrl: z.string().url().optional().nullable(),
  articleId: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const regulation = await prisma.regulation.findUnique({
      where: { id: params.id },
    });
    if (!regulation) throw new ApiError("Regulasi tidak ditemukan", 404);

    return successResponse(regulation);
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

    const existing = await prisma.regulation.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Regulasi tidak ditemukan", 404);

    const body = await req.json();
    const data = updateSchema.parse(body);

    const updated = await prisma.regulation.update({
      where: { id: params.id },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.number !== undefined && { number: data.number.trim() }),
        ...(data.year !== undefined && { year: data.year }),
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.shortTitle !== undefined && {
          shortTitle: data.shortTitle?.trim() ?? null,
        }),
        ...(data.topic !== undefined && {
          topic: data.topic?.trim() ?? null,
        }),
        ...(data.description !== undefined && {
          description: data.description?.trim() ?? null,
        }),
        ...(data.enactedAt !== undefined && {
          enactedAt: data.enactedAt ? new Date(data.enactedAt) : null,
        }),
        ...(data.effectiveAt !== undefined && {
          effectiveAt: data.effectiveAt ? new Date(data.effectiveAt) : null,
        }),
        ...(data.issuedBy !== undefined && {
          issuedBy: data.issuedBy?.trim() ?? null,
        }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.sourceUrl !== undefined && {
          sourceUrl: data.sourceUrl ?? null,
        }),
        ...(data.pdfUrl !== undefined && { pdfUrl: data.pdfUrl ?? null }),
        ...(data.articleId !== undefined && {
          articleId: data.articleId ?? null,
        }),
        ...(data.isPublished !== undefined && {
          isPublished: data.isPublished,
        }),
      },
    });

    await logAudit(
      session.user.id,
      "REGULATION_UPDATE",
      "Regulation",
      params.id,
      `Updated ${updated.type} No. ${updated.number} Tahun ${updated.year}`
    );

    return successResponse(updated);
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

    const existing = await prisma.regulation.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Regulasi tidak ditemukan", 404);

    await prisma.regulation.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "REGULATION_DELETE",
      "Regulation",
      params.id,
      `Deleted ${existing.type} No. ${existing.number} Tahun ${existing.year}: ${existing.title.slice(0, 80)}`
    );

    return successResponse({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
