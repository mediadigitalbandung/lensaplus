/**
 * GET  /api/topics  — List all topics (public: isPublished=true; admin: all)
 * POST /api/topics  — Create topic (SUPER_ADMIN | CHIEF_EDITOR)
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
import { isSafeImageRef } from "@/lib/safe-path";
import { rethrowMappedPrismaError } from "@/lib/security";

// Topic model added via schema migration — cast needed until Prisma client regenerates.
const db = prisma as any; // biome-ignore lint: prisma cast

export const dynamic = "force-dynamic";

const MANAGEMENT_ROLES: Role[] = ["SUPER_ADMIN", "CHIEF_EDITOR"];

const createTopicSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung"),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  metaTitle: z.string().max(70).optional().nullable(),
  metaDescription: z.string().max(160).optional().nullable(),
  coverImage: z.string().refine(isSafeImageRef, "URL atau path cover tidak valid").optional().nullable(),
  isPublished: z.boolean().optional(),
  tagSlugs: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminMode = searchParams.get("admin") === "true";

    // Admin mode: requires auth — caller must be MANAGEMENT_ROLES (never swallow 401/403).
    // Public mode: only published topics.
    let isAdminSession = false;
    if (adminMode) {
      await requireRole(MANAGEMENT_ROLES);
      isAdminSession = true;
    }

    const topics = await db.topic.findMany({
      where: isAdminSession ? undefined : { isPublished: true },
      include: {
        tags: { select: { id: true, name: true, slug: true } },
        _count: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(topics);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(MANAGEMENT_ROLES);
    const body = await request.json();
    const data = createTopicSchema.parse(body);
    const { tagSlugs, ...topicData } = data;

    // Check slug uniqueness
    const existing = await db.topic.findUnique({
      where: { slug: topicData.slug },
    });
    if (existing) {
      throw new ApiError("Slug sudah digunakan", 409);
    }

    // Resolve tag slugs & verify every requested tag exists
    let tagConnect: { slug: string }[] = [];
    if (tagSlugs && tagSlugs.length > 0) {
      const uniqueSlugs = Array.from(new Set(tagSlugs));
      const foundTags = await prisma.tag.findMany({
        where: { slug: { in: uniqueSlugs } },
        select: { slug: true },
      });
      const foundSet = new Set(foundTags.map((t) => t.slug));
      const missing = uniqueSlugs.filter((s) => !foundSet.has(s));
      if (missing.length > 0) {
        throw new ApiError(`Tag tidak ditemukan: ${missing.join(", ")}`, 400);
      }
      tagConnect = uniqueSlugs.map((s) => ({ slug: s }));
    }

    const topic = await db.topic
      .create({
        data: {
          ...topicData,
          isPublished: topicData.isPublished ?? true,
          tags: tagConnect.length > 0 ? { connect: tagConnect } : undefined,
        },
        include: {
          tags: { select: { id: true, name: true, slug: true } },
        },
      })
      .catch((err: unknown) => rethrowMappedPrismaError(err, { unique: "Slug topik sudah digunakan" }));

    await logAudit(
      session.user.id,
      "CREATE",
      "topic",
      topic.id,
      `Membuat topic cluster: ${topic.name}`,
    );

    return successResponse(topic, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
