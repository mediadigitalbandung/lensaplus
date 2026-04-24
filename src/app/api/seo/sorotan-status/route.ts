/**
 * GET  /api/seo/sorotan-status — aggregate Sorotan indexStatus counts
 * POST /api/seo/sorotan-status — manually update a single Sorotan's status
 *
 * Auth: EDITOR+
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const groups = await prisma.sorotan.groupBy({
      by: ["indexStatus"],
      _count: { _all: true },
    });

    const total = await prisma.sorotan.count();
    const counts: Record<string, number> = {
      pending: 0,
      submitted: 0,
      indexed: 0,
      failed: 0,
      unknown: 0,
    };
    for (const g of groups) {
      const key = g.indexStatus ?? "unknown";
      counts[key] = (counts[key] ?? 0) + g._count._all;
    }

    const lastSubmitted = await prisma.sorotan.findFirst({
      where: { lastIndexedAt: { not: null } },
      orderBy: { lastIndexedAt: "desc" },
      select: { id: true, slug: true, title: true, lastIndexedAt: true, indexStatus: true },
    });

    return successResponse({ total, counts, lastSubmitted });
  } catch (err) {
    return errorResponse(err);
  }
}

const postSchema = z.object({
  sorotanId: z.string().min(1),
  status: z.enum(["pending", "submitted", "indexed", "failed"]),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json();
    const { sorotanId, status } = postSchema.parse(body);

    const updated = await prisma.sorotan.update({
      where: { id: sorotanId },
      data: {
        indexStatus: status,
        ...(status === "submitted" || status === "indexed"
          ? { lastIndexedAt: new Date() }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        indexStatus: true,
        lastIndexedAt: true,
      },
    });

    return successResponse(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
