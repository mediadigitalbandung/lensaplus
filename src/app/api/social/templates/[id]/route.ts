/**
 * GET    /api/social/templates/:id — detail
 * PUT    /api/social/templates/:id — update
 * DELETE /api/social/templates/:id — delete
 * Auth: SUPER_ADMIN (aligned with /panel/social in src/proxy.ts)
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
import { isSafeImageRef, resolvePublicSubpath } from "@/lib/safe-path";

function isValidTemplateBg(val: string): boolean {
  return isSafeImageRef(val) || resolvePublicSubpath(val) !== null;
}

export const dynamic = "force-dynamic";

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

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TWITTER", "THREADS"]).optional(),
  categoryId: z.string().nullable().optional(),
  backgroundUrl: z
    .string()
    .min(1)
    .refine(isValidTemplateBg, "URL atau path background template tidak valid")
    .optional(),
  textLayers: z.array(textLayerSchema).max(50).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    await requireRole(["SUPER_ADMIN"]);
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
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
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
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
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
