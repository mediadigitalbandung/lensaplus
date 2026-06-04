/**
 * GET /api/seo/sorotan-by-author — Sorotan SEO entries grouped per author.
 *
 * Editorial-oversight view: every editor-tier user sees the Sorotan of ALL
 * writers, grouped per author, so the team's SEO highlight output can be
 * monitored at a glance. Powers the "Editor" tab in /panel/statistik.
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 */

import { prisma } from "@/lib/prisma";
import { errorResponse, requireRole, successResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

interface SorotanItem {
  slug: string;
  title: string;
  angle: string;
  indexStatus: string;
  articleSlug: string;
  createdAt: string;
}

interface AuthorGroup {
  authorId: string;
  authorName: string;
  total: number;
  indexed: number;
  submitted: number;
  pending: number;
  failed: number;
  items: SorotanItem[];
}

// Per-author cap on the detailed item list shown when a writer is expanded.
const ITEMS_PER_AUTHOR = 15;
// Upper bound on rows scanned to build the per-author breakdown. If the total
// Sorotan count exceeds this, the grouped numbers reflect the most recent
// SCAN_LIMIT entries (surfaced to the UI via `sampled`) rather than silently
// undercounting — the authoritative all-time total is returned as `grandTotal`.
const SCAN_LIMIT = 4000;

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const [grandTotal, rows] = await Promise.all([
      prisma.sorotan.count(),
      prisma.sorotan.findMany({
      orderBy: { createdAt: "desc" },
      take: SCAN_LIMIT,
      select: {
        slug: true,
        title: true,
        angle: true,
        indexStatus: true,
        createdAt: true,
        article: {
          select: {
            slug: true,
            authorId: true,
            author: { select: { name: true } },
          },
        },
      },
      }),
    ]);

    const map = new Map<string, AuthorGroup>();

    for (const r of rows) {
      const authorId = r.article?.authorId ?? "unknown";
      let g = map.get(authorId);
      if (!g) {
        g = {
          authorId,
          authorName: r.article?.author?.name ?? "Tanpa Penulis",
          total: 0,
          indexed: 0,
          submitted: 0,
          pending: 0,
          failed: 0,
          items: [],
        };
        map.set(authorId, g);
      }

      g.total += 1;
      const status = (r.indexStatus ?? "pending").toLowerCase();
      if (status === "indexed") g.indexed += 1;
      else if (status === "submitted") g.submitted += 1;
      else if (status === "failed") g.failed += 1;
      else g.pending += 1;

      if (g.items.length < ITEMS_PER_AUTHOR) {
        g.items.push({
          slug: r.slug,
          title: r.title,
          angle: r.angle,
          indexStatus: status,
          articleSlug: r.article?.slug ?? "",
          createdAt: r.createdAt.toISOString(),
        });
      }
    }

    const authors = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const scanned = rows.length;

    return successResponse({
      authors,
      grandTotal,
      scanned,
      // True when older entries fell outside the scan window — the per-author
      // breakdown then reflects the most recent `scanned` Sorotan, not all-time.
      sampled: grandTotal > scanned,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
