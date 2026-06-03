/**
 * GET /api/stats/internal?from=YYYY-MM-DD&to=YYYY-MM-DD&scope=all|me
 * Returns Prisma-sourced dashboard numbers (articles, users, views, AI usage, etc.).
 *
 * Auth: any writer role. Visibility:
 *  - Editors+ (EDITOR_ROLES) see site-wide ("general") stats by default, and
 *    can request their personal numbers with ?scope=me.
 *  - Creators (journalist/contributor) are always scoped to their own articles
 *    (any ?scope=all is ignored).
 */

import {
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { getInternalStats } from "@/lib/stats/internal";
import { SCRAPER_ROLES, EDITOR_ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

function parseDate(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: Request) {
  try {
    // Open to every writer role. Editors+ see site-wide ("general") numbers;
    // creators are hard-scoped to their own. Either tier can ask for their
    // personal figures with ?scope=me — so we scope to the user's own articles
    // when they are not an editor OR when scope=me is requested.
    const session = await requireRole([...SCRAPER_ROLES]);
    const url = new URL(req.url);
    const canSeeAll = EDITOR_ROLES.includes(session.user.role);
    const personal = !canSeeAll || url.searchParams.get("scope") === "me";
    const authorId = personal ? session.user.id : undefined;

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
