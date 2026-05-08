/**
 * GET    /api/topics/[id]  — Get topic by id or slug
 * PUT    /api/topics/[id]  — Update topic (SUPER_ADMIN | CHIEF_EDITOR)
 * DELETE /api/topics/[id]  — Delete topic (SUPER_ADMIN | CHIEF_EDITOR)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  logAudit,
  ApiError,
} from "@/lib/api-utils";
import { Role } from "@prisma/client";

// Topic model added via schema migration — cast needed until Prisma client regenerates.
const db = prisma as any; // biome-ignore lint: prisma cast

export const dynamic = "force-dynamic";

const MANAGEMENT_ROLES: Role[] = ["SUPER_ADMIN", "CHIEF_EDITOR"];

const updateTopicSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung")
    .optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  metaTitle: z.string().max(70).optional().nullable(),
  metaDescription: z.string().max(160).optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  isPublished: z.boolean().optional(),
  tagSlugs: z.array(z.string()).optional(),
});

export async function GET(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    // Support lookup by id OR slug
    const topic = await db.topic.findFirst({
      where: {
        OR: [{ id: params.id }, { slug: params.id }],
      },
      include: {
        tags: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!topic) {
      throw new ApiError("Topic tidak ditemukan", 404);
    }

    return successResponse(topic);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(MANAGEMENT_ROLES);
    const body = await request.json();
    const data = updateTopicSchema.parse(body);
    const { tagSlugs, ...topicData } = data;

    const existing = await db.topic.findUnique({ where: { id: params.id } });
    if (!existing) {
      throw new ApiError("Topic tidak ditemukan", 404);
    }

    // Slug uniqueness check if changing slug
    if (topicData.slug && topicData.slug !== existing.slug) {
      const slugConflict = await db.topic.findUnique({
        where: { slug: topicData.slug },
      });
      if (slugConflict) {
        throw new ApiError("Slug sudah digunakan", 409);
      }
    }

    const updated = await db.topic.update({
      where: { id: params.id },
      data: {
        ...topicData,
        ...(tagSlugs !== undefined && {
          tags: {
            set: [],
            connect: tagSlugs.map((s) => ({ slug: s })),
          },
        }),
      },
      include: {
        tags: { select: { id: true, name: true, slug: true } },
      },
    });

    await logAudit(
      session.user.id,
      "UPDATE",
      "topic",
      params.id,
      `Update topic cluster: ${updated.name}`,
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(MANAGEMENT_ROLES);

    const existing = await db.topic.findUnique({ where: { id: params.id } });
    if (!existing) {
      throw new ApiError("Topic tidak ditemukan", 404);
    }

    await db.topic.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "DELETE",
      "topic",
      params.id,
      `Hapus topic cluster: ${existing.name}`,
    );

    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
