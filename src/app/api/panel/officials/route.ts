/**
 * GET  /api/panel/officials — admin listing with pagination & filters
 * POST /api/panel/officials — create new official
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { slugify } from "@/lib/utils";
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

const createSchema = z.object({
  name: z.string().min(1).max(300),
  fullName: z.string().max(400).optional().nullable(),
  position: z.string().min(1).max(300),
  institution: z.string().min(1).max(300),
  level: z.enum([
    "NASIONAL",
    "PROVINSI",
    "KOTA_KABUPATEN",
    "KECAMATAN",
    "YUDIKATIF",
    "LEMBAGA",
    "OTHER",
  ]),
  region: z.string().max(200).optional().nullable(),
  status: z
    .enum(["AKTIF", "PURNA", "CUTI", "NONAKTIF"])
    .default("AKTIF"),
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
  isPublished: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    );
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const levelParam = searchParams.get("level");
    const searchParam = searchParams.get("search");
    const statusParam = searchParams.get("status");

    const where: Prisma.PublicOfficialWhereInput = {
      ...(levelParam && VALID_LEVELS.has(levelParam)
        ? { level: levelParam as Prisma.EnumOfficialLevelFilter }
        : {}),
      ...(statusParam
        ? { status: statusParam as Prisma.EnumOfficialStatusFilter }
        : {}),
      ...(searchParam
        ? {
            OR: [
              { name: { contains: searchParam, mode: "insensitive" } },
              { position: { contains: searchParam, mode: "insensitive" } },
              { institution: { contains: searchParam, mode: "insensitive" } },
              { region: { contains: searchParam, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [officials, total] = await Promise.all([
      prisma.publicOfficial.findMany({
        where,
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

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const body = await req.json();
    const data = createSchema.parse(body);

    // Auto-generate unique slug from name
    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.publicOfficial.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const official = await prisma.publicOfficial.create({
      data: {
        slug,
        name: data.name.trim(),
        fullName: data.fullName?.trim() ?? null,
        position: data.position.trim(),
        institution: data.institution.trim(),
        level: data.level,
        region: data.region?.trim() ?? null,
        status: data.status,
        termStart: data.termStart ? new Date(data.termStart) : null,
        termEnd: data.termEnd ? new Date(data.termEnd) : null,
        bio: data.bio?.trim() ?? null,
        birthplace: data.birthplace?.trim() ?? null,
        birthdate: data.birthdate ? new Date(data.birthdate) : null,
        education: data.education?.trim() ?? null,
        career: data.career?.trim() ?? null,
        party: data.party?.trim() ?? null,
        photoUrl: data.photoUrl ?? null,
        websiteUrl: data.websiteUrl ?? null,
        twitterHandle: data.twitterHandle?.trim() ?? null,
        instagramHandle: data.instagramHandle?.trim() ?? null,
        isPublished: data.isPublished,
      },
    });

    await logAudit(
      session.user.id,
      "OFFICIAL_CREATE",
      "PublicOfficial",
      official.id,
      `Created ${data.position} — ${data.name} (${data.institution})`
    );

    return successResponse(official, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
