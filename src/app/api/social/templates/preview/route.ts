/**
 * POST /api/social/templates/preview
 * Body: { templateId: string, articleId: string }
 * Returns: image/jpeg binary (the rendered template).
 * Auth: EDITOR+
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  requireRole,
} from "@/lib/api-utils";
import { renderTemplate } from "@/lib/social/template-renderer";
import type { ArticleForPublish } from "@/lib/social/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  templateId: z.string().min(1),
  articleId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json();
    const { templateId, articleId } = bodySchema.parse(body);

    const [template, article] = await Promise.all([
      prisma.socialTemplate.findUnique({ where: { id: templateId } }),
      prisma.article.findUnique({
        where: { id: articleId },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true } },
          tags: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);
    if (!template) throw new ApiError("Template not found", 404);
    if (!article) throw new ApiError("Article not found", 404);

    const { buffer } = await renderTemplate(
      template,
      article as unknown as ArticleForPublish,
    );

    // Copy the Buffer into a fresh ArrayBuffer so it satisfies BodyInit.
    const ab = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(ab).set(buffer);

    return new NextResponse(ab, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
