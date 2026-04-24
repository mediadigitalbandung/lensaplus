/**
 * GET  /api/social/templates — list, optional ?platform=&categoryId=&isActive=
 * POST /api/social/templates — create a template
 * Auth: EDITOR+
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

const ALLOWED_PLATFORMS = new Set(["INSTAGRAM", "FACEBOOK", "TWITTER"]);

const textLayerSchema = z.object({
  text: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  fontSize: z.number(),
  fontFamily: z.string().optional(),
  weight: z.union([z.string(), z.number()]).optional(),
  color: z.string().optional(),
  lineHeight: z.number().optional(),
  maxLines: z.number().int().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TWITTER"]),
  categoryId: z.string().nullable().optional(),
  backgroundUrl: z.string().min(1),
  textLayers: z.array(textLayerSchema),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform");
    const categoryId = searchParams.get("categoryId");
    const isActiveRaw = searchParams.get("isActive");

    const where: Prisma.SocialTemplateWhereInput = {};
    if (platform && ALLOWED_PLATFORMS.has(platform)) {
      where.platform = platform as Prisma.SocialTemplateWhereInput["platform"];
    }
    if (categoryId) where.categoryId = categoryId;
    if (isActiveRaw === "true") where.isActive = true;
    if (isActiveRaw === "false") where.isActive = false;

    const templates = await prisma.socialTemplate.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return successResponse({ templates });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
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
