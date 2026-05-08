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

    const [groups, total, lastSubmitted, errorSamples] = await Promise.all([
      prisma.sorotan.groupBy({
        by: ["indexStatus"],
        _count: { _all: true },
      }),
      prisma.sorotan.count(),
      prisma.sorotan.findFirst({
        where: { lastIndexedAt: { not: null } },
        orderBy: { lastIndexedAt: "desc" },
        select: { id: true, slug: true, title: true, lastIndexedAt: true, indexStatus: true },
      }),
      prisma.sorotan.findMany({
        where: {
          indexStatus: "failed",
          indexLastError: { not: null },
        },
        select: { indexLastError: true },
        take: 500,
      }),
    ]);

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

    const errorBuckets = new Map<string, number>();
    for (const r of errorSamples) {
      const msg = (r.indexLastError ?? "").trim();
      if (!msg) continue;
      const key = msg.split(/[\.\n]/)[0].trim().slice(0, 200);
      errorBuckets.set(key, (errorBuckets.get(key) ?? 0) + 1);
    }
    const topErrors = Array.from(errorBuckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    return successResponse({ total, counts, lastSubmitted, topErrors });
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
        // Clear stale error message when manually marking as success state.
        ...(status === "submitted" || status === "indexed"
          ? { lastIndexedAt: new Date(), indexLastError: null }
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
