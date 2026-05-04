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
  coverImage: z.string().url().optional().nullable(),
  isPublished: z.boolean().optional(),
  tagSlugs: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminMode = searchParams.get("admin") === "true";

    // Admin mode: requires auth — caller must be MANAGEMENT_ROLES.
    // Public mode: only published topics.
    let isAdminSession = false;
    if (adminMode) {
      try {
        await requireRole(MANAGEMENT_ROLES);
        isAdminSession = true;
      } catch {
        // Fall through to public mode if not authorised.
      }
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

    // Resolve tag IDs from slugs
    let tagConnect: { slug: string }[] = [];
    if (tagSlugs && tagSlugs.length > 0) {
      tagConnect = tagSlugs.map((s) => ({ slug: s }));
    }

    const topic = await db.topic.create({
      data: {
        ...topicData,
        isPublished: topicData.isPublished ?? true,
        tags: tagConnect.length > 0 ? { connect: tagConnect } : undefined,
      },
      include: {
        tags: { select: { id: true, name: true, slug: true } },
      },
    });

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
