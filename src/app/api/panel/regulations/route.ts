/**
 * GET  /api/panel/regulations — admin listing with pagination & filters
 * POST /api/panel/regulations — create new regulation
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

const createSchema = z.object({
  type: z.enum([
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
  ]),
  number: z.string().min(1).max(100),
  year: z.number().int().min(1945).max(2100),
  title: z.string().min(1).max(2000),
  shortTitle: z.string().max(200).optional().nullable(),
  topic: z.string().max(200).optional().nullable(),
  description: z.string().max(20000).optional().nullable(),
  enactedAt: z.string().datetime().optional().nullable(),
  effectiveAt: z.string().datetime().optional().nullable(),
  issuedBy: z.string().max(300).optional().nullable(),
  status: z
    .enum(["DRAFT_RUU", "ENACTED", "AMENDED", "REVOKED"])
    .default("ENACTED"),
  sourceUrl: z.string().url().optional().nullable(),
  pdfUrl: z.string().url().optional().nullable(),
  articleId: z.string().optional().nullable(),
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
    const typeParam = searchParams.get("type");
    const searchParam = searchParams.get("search");

    const where: Prisma.RegulationWhereInput = {
      ...(typeParam && VALID_TYPES.has(typeParam)
        ? { type: typeParam as Prisma.EnumRegulationTypeFilter }
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
        orderBy: [{ year: "desc" }, { enactedAt: "desc" }, { createdAt: "desc" }],
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

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const body = await req.json();
    const data = createSchema.parse(body);

    const regulation = await prisma.regulation.create({
      data: {
        type: data.type,
        number: data.number.trim(),
        year: data.year,
        title: data.title.trim(),
        shortTitle: data.shortTitle?.trim() ?? null,
        topic: data.topic?.trim() ?? null,
        description: data.description?.trim() ?? null,
        enactedAt: data.enactedAt ? new Date(data.enactedAt) : null,
        effectiveAt: data.effectiveAt ? new Date(data.effectiveAt) : null,
        issuedBy: data.issuedBy?.trim() ?? null,
        status: data.status,
        sourceUrl: data.sourceUrl ?? null,
        pdfUrl: data.pdfUrl ?? null,
        articleId: data.articleId ?? null,
        isPublished: data.isPublished,
      },
    });

    await logAudit(
      session.user.id,
      "REGULATION_CREATE",
      "Regulation",
      regulation.id,
      `Created ${data.type} No. ${data.number} Tahun ${data.year}: ${data.title.slice(0, 100)}`
    );

    return successResponse(regulation, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
