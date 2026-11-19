/**
 * GET  /api/social/templates — list, optional ?platform=&categoryId=&isActive=
 * POST /api/social/templates — create a template
 * Auth: SUPER_ADMIN (aligned with /panel/social in src/proxy.ts)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
  parsePositiveInt,
} from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";
import { isSafeImageRef, resolvePublicSubpath } from "@/lib/safe-path";

function isValidTemplateBg(val: string): boolean {
  return isSafeImageRef(val) || resolvePublicSubpath(val) !== null;
}

export const dynamic = "force-dynamic";

const ALLOWED_PLATFORMS = new Set(["INSTAGRAM", "FACEBOOK", "TWITTER", "THREADS"]);
const MAX_CANVAS_DIM = 4096;

const textLayerSchema = z
  .object({
    text: z.string().max(1000),
    x: z.number().finite().min(0).max(MAX_CANVAS_DIM),
    y: z.number().finite().min(0).max(MAX_CANVAS_DIM),
    width: z.number().finite().min(0).max(MAX_CANVAS_DIM),
    height: z.number().finite().min(0).max(MAX_CANVAS_DIM),
    fontSize: z.number().finite().min(0).max(500),
    fontFamily: z.string().max(200).optional(),
    weight: z.union([z.string().max(30), z.number().finite().min(100).max(1000)]).optional(),
    color: z.string().max(50).optional(),
    lineHeight: z.number().finite().min(0.5).max(5).optional(),
    maxLines: z.number().int().min(1).max(50).optional(),
    align: z.enum(["left", "center", "right", "justify"]).optional(),
  })
  .superRefine((layer, ctx) => {
    if (layer.text === "{{canvas_metadata}}") {
      if (layer.x < 1 || layer.y < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dimensi kanvas (x, y) minimal 1px dan maksimal 4096px",
          path: ["x"],
        });
      }
    } else if (layer.width < 1 || layer.height < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dimensi layer (width, height) minimal 1px dan maksimal 4096px",
        path: ["width"],
      });
    }
  });

const createSchema = z.object({
  name: z.string().min(1).max(120),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TWITTER", "THREADS"]),
  categoryId: z.string().nullable().optional(),
  backgroundUrl: z
    .string()
    .min(1)
    .refine(isValidTemplateBg, "URL atau path background template tidak valid"),
  textLayers: z.array(textLayerSchema).max(50),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform");
    const categoryId = searchParams.get("categoryId");
    const isActiveRaw = searchParams.get("isActive");
    const limit = parsePositiveInt(searchParams.get("limit"), 50, 100);
    const page = parsePositiveInt(searchParams.get("page"), 1);

    const where: Prisma.SocialTemplateWhereInput = {};
    if (platform && ALLOWED_PLATFORMS.has(platform)) {
      where.platform = platform as Prisma.SocialTemplateWhereInput["platform"];
    }
    if (categoryId) where.categoryId = categoryId;
    if (isActiveRaw === "true") where.isActive = true;
    if (isActiveRaw === "false") where.isActive = false;

    const [templates, total] = await Promise.all([
      prisma.socialTemplate.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.socialTemplate.count({ where }),
    ]);

    return successResponse({ templates, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await req.json();
    const data = createSchema.parse(body);

    const created = await prisma.socialTemplate.create({
      data: {
        name: data.name,
        platform: data.platform,
        categoryId: data.categoryId || null,
        backgroundUrl: data.backgroundUrl,
        textLayers: data.textLayers as unknown as Prisma.InputJsonValue,
        isActive: data.isActive ?? true,
      },
    });

    await logAudit(
      session.user.id,
      "CREATE",
      "social_template",
      created.id,
      `Created template ${created.name} (${created.platform})`,
    );

    return successResponse(created, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
