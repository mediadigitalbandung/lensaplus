import { requireRole, successResponse, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Normalize a title for duplicate matching: trim, lowercase, collapse spaces,
// strip a trailing " (2)" / "-2" style suffix that a re-publish/slug-collision
// might have appended.
function normTitle(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s-]*\(?\d+\)?$/, "")
    .trim();
}

// Higher score = more worth keeping. Engagement first (comments/revisions),
// then views, then it being PUBLISHED, with earliest-created as the tie-break
// (handled separately as the canonical "original").
function keepScore(a: {
  status: string;
  viewCount: number;
  _count: { comments: number; revisions: number; corrections: number };
}): number {
  const engagement =
    a._count.comments * 100 + a._count.corrections * 50 + a._count.revisions * 5;
  const published = a.status === "PUBLISHED" ? 1000 : 0;
  return published + engagement + a.viewCount;
}

// GET /api/articles/duplicates — list groups of same-title articles so an admin
// can review and remove the extras created by the publish-retry bug.
export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    const articles = await prisma.article.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        createdAt: true,
        publishedAt: true,
        viewCount: true,
        author: { select: { name: true } },
        category: { select: { name: true } },
        _count: { select: { comments: true, revisions: true, corrections: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const byTitle = new Map<string, typeof articles>();
    for (const a of articles) {
      const k = normTitle(a.title);
      if (!k) continue;
      const arr = byTitle.get(k) ?? [];
      arr.push(a);
      byTitle.set(k, arr);
    }

    const groups = [...byTitle.entries()]
      .filter(([, g]) => g.length > 1)
      .map(([key, g]) => {
        // Pick the copy to KEEP: highest keepScore; tie → earliest createdAt.
        let keep = g[0];
        for (const a of g) {
          const better = keepScore(a) - keepScore(keep);
          if (better > 0 || (better === 0 && a.createdAt < keep.createdAt)) keep = a;
        }
        return {
          key,
          title: keep.title,
          copies: g.map((a) => ({
            id: a.id,
            title: a.title,
            slug: a.slug,
            status: a.status,
            createdAt: a.createdAt,
            publishedAt: a.publishedAt,
            viewCount: a.viewCount,
            author: a.author?.name ?? "—",
            category: a.category?.name ?? "—",
            comments: a._count.comments,
            revisions: a._count.revisions,
            recommendedKeep: a.id === keep.id,
          })),
        };
      })
      // Show the biggest / most-published groups first.
      .sort((a, b) => b.copies.length - a.copies.length);

    const totalExtra = groups.reduce((n, g) => n + g.copies.length - 1, 0);

    return successResponse({ groups, totalGroups: groups.length, totalExtra });
  } catch (error) {
    return errorResponse(error);
  }
}
