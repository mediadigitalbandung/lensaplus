/**
 * POST /api/social/test-publish
 * Body: { articleId?: string }
 * Runs the full orchestrator. If articleId is not supplied, picks the most
 * recent PUBLISHED article. Intended for end-to-end smoke-testing after
 * configuring the platform access tokens.
 * Auth: SUPER_ADMIN
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { publishArticleToSocial } from "@/lib/social/orchestrator";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  articleId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const raw = await req.json().catch(() => ({}));
    const { articleId } = bodySchema.parse(raw || {});

    let targetId = articleId;
    if (!targetId) {
      const latest = await prisma.article.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        select: { id: true },
      });
      if (!latest) throw new ApiError("No PUBLISHED article available for test-publish", 404);
      targetId = latest.id;
    }

    const result = await publishArticleToSocial(targetId);

    await logAudit(
      session.user.id,
      "TEST_PUBLISH",
      "article",
      targetId,
      `Test-publish run: ${JSON.stringify(result.results)}`,
    );

    return successResponse({ articleId: targetId, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
