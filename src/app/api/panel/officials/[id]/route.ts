/**
 * GET    /api/panel/officials/:id — detail (admin)
 * PUT    /api/panel/officials/:id — full update
 * DELETE /api/panel/officials/:id — delete
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
  name: z.string().min(1).max(300).optional(),
  fullName: z.string().max(400).optional().nullable(),
  position: z.string().min(1).max(300).optional(),
  institution: z.string().min(1).max(300).optional(),
  level: z
    .enum([
      "NASIONAL",
      "PROVINSI",
      "KOTA_KABUPATEN",
      "KECAMATAN",
      "YUDIKATIF",
      "LEMBAGA",
      "OTHER",
    ])
    .optional(),
  region: z.string().max(200).optional().nullable(),
  status: z.enum(["AKTIF", "PURNA", "CUTI", "NONAKTIF"]).optional(),
  termStart: z.string().datetime().optional().nullable(),
  termEnd: z.string().datetime().optional().nullable(),
  bio: z.string().max(20000).optional().nullable(),
  birthplace: z.string().max(200).optional().nullable(),
  birthdate: z.string().datetime().optional().nullable(),
  education: z.string().max(10000).optional().nullable(),
  career: z.string().max(20000).optional().nullable(),
  party: z.string().max(200).optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
  twitterHandle: z.string().max(100).optional().nullable(),
  instagramHandle: z.string().max(100).optional().nullable(),
  isPublished: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const official = await prisma.publicOfficial.findUnique({
      where: { id: params.id },
    });
    if (!official) throw new ApiError("Pejabat tidak ditemukan", 404);

    return successResponse(official);
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

    const existing = await prisma.publicOfficial.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Pejabat tidak ditemukan", 404);

    const body = await req.json();
    const data = updateSchema.parse(body);

    const updated = await prisma.publicOfficial.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.fullName !== undefined && { fullName: data.fullName?.trim() ?? null }),
        ...(data.position !== undefined && { position: data.position.trim() }),
        ...(data.institution !== undefined && { institution: data.institution.trim() }),
        ...(data.level !== undefined && { level: data.level }),
        ...(data.region !== undefined && { region: data.region?.trim() ?? null }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.termStart !== undefined && {
          termStart: data.termStart ? new Date(data.termStart) : null,
        }),
        ...(data.termEnd !== undefined && {
          termEnd: data.termEnd ? new Date(data.termEnd) : null,
        }),
        ...(data.bio !== undefined && { bio: data.bio?.trim() ?? null }),
        ...(data.birthplace !== undefined && {
          birthplace: data.birthplace?.trim() ?? null,
        }),
        ...(data.birthdate !== undefined && {
          birthdate: data.birthdate ? new Date(data.birthdate) : null,
        }),
        ...(data.education !== undefined && {
          education: data.education?.trim() ?? null,
        }),
        ...(data.career !== undefined && { career: data.career?.trim() ?? null }),
        ...(data.party !== undefined && { party: data.party?.trim() ?? null }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl ?? null }),
        ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl ?? null }),
        ...(data.twitterHandle !== undefined && {
          twitterHandle: data.twitterHandle?.trim() ?? null,
        }),
        ...(data.instagramHandle !== undefined && {
          instagramHandle: data.instagramHandle?.trim() ?? null,
        }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
      },
    });

    await logAudit(
      session.user.id,
      "OFFICIAL_UPDATE",
      "PublicOfficial",
      params.id,
      `Updated ${updated.position} — ${updated.name}`
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

    const existing = await prisma.publicOfficial.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Pejabat tidak ditemukan", 404);

    await prisma.publicOfficial.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "OFFICIAL_DELETE",
      "PublicOfficial",
      params.id,
      `Deleted ${existing.position} — ${existing.name} (${existing.institution})`
    );

    return successResponse({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
