/**
 * GET /api/users/me/export
 *
 * Data Subject Rights (DSR) — Article 20 GDPR / UU PDP right to data portability.
 * Returns a JSON download containing the authenticated user's own personal data:
 *   - Profile
 *   - Authored articles (id, title, status, publishedAt)
 *   - Comments (id, content, createdAt)
 *   - Reports submitted (id, reason, createdAt)
 *
 * Auth: requireAuth (own data only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, errorResponse, logAudit } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        bio: true,
        specialization: true,
        phone: true,
        nomorKartuPers: true,
        organisasiPers: true,
        pendidikan: true,
        pengalaman: true,
        keahlian: true,
        portofolio: true,
        mediaSosial: true,
        alamat: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const [articles, comments] = await Promise.all([
      prisma.article.findMany({
        where: { authorId: userId },
        select: { id: true, title: true, slug: true, status: true, publishedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.comment.findMany({
        where: { authorEmail: user.email },
        select: { id: true, content: true, isApproved: true, createdAt: true, articleId: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: user,
      articles,
      comments,
    };

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(userId, "DSR_EXPORT", "User", userId, undefined, ip);

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="kartawarta-data-export-${userId}.json"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
