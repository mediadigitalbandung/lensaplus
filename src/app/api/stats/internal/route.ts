/**
 * GET /api/stats/internal?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns Prisma-sourced dashboard numbers (articles, users, views, AI usage, etc.).
 * Auth: EDITOR+
 */

import {
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { getInternalStats } from "@/lib/stats/internal";
import { SCRAPER_ROLES } from "@/lib/roles";
import { canViewAllArticles } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parseDate(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: Request) {
  try {
    // Open to every writer role — but a non-SUPER_ADMIN only sees their OWN
    // stats (scoped by authorId); SUPER_ADMIN sees site-wide.
    const session = await requireRole([...SCRAPER_ROLES]);
    const authorId = canViewAllArticles(session.user.role)
      ? undefined
      : session.user.id;

    const url = new URL(req.url);
    const from =
      parseDate(url.searchParams.get("from")) ??
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = parseDate(url.searchParams.get("to")) ?? new Date();

    const data = await getInternalStats({ from, to, authorId });

    return successResponse({
      ...data,
      _meta: {
        ...data._meta,
        provider: "internal",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
