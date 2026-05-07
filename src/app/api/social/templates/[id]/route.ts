/**
 * GET    /api/social/templates/:id — detail
 * PUT    /api/social/templates/:id — update
 * DELETE /api/social/templates/:id — delete
 * Auth: EDITOR+
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

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

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TWITTER"]).optional(),
  categoryId: z.string().nullable().optional(),
  backgroundUrl: z.string().min(1).optional(),
  textLayers: z.array(textLayerSchema).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const tpl = await prisma.socialTemplate.findUnique({
      where: { id: params.id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!tpl) throw new ApiError("Template not found", 404);
    return successResponse(tpl);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const existing = await prisma.socialTemplate.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Template not found", 404);

    const body = await req.json();
    const data = updateSchema.parse(body);

    const updateData: Prisma.SocialTemplateUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.categoryId !== undefined) {
      updateData.category = data.categoryId
        ? { connect: { id: data.categoryId } }
        : { disconnect: true };
    }
    if (data.backgroundUrl !== undefined) updateData.backgroundUrl = data.backgroundUrl;
    if (data.textLayers !== undefined) {
      updateData.textLayers = data.textLayers as unknown as Prisma.InputJsonValue;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.socialTemplate.update({
      where: { id: params.id },
      data: updateData,
    });

    await logAudit(
      session.user.id,
      "UPDATE",
      "social_template",
      params.id,
      `Updated template ${updated.name}`,
    );

    return successResponse(updated);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const existing = await prisma.socialTemplate.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Template not found", 404);

    await prisma.socialTemplate.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "DELETE",
      "social_template",
      params.id,
      `Deleted template ${existing.name}`,
    );

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
