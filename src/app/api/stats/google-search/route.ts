/**
 * GET /api/stats/google-search?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns Search Console aggregates, top queries, top pages, daily trend.
 * Auth: EDITOR+
 *
 * If credentials are missing or the API call fails, responds HTTP 200 with
 * `{ success: false, error, data: <empty struct> }` so the UI doesn't crash.
 */

import { errorResponse, requireRole, successResponse } from "@/lib/api-utils";
import { getGSCData } from "@/lib/stats/google-search";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseDateParam(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return ymd(d);
}

export async function GET(req: Request) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const url = new URL(req.url);
    const from =
      parseDateParam(url.searchParams.get("from")) ??
      ymd(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const to = parseDateParam(url.searchParams.get("to")) ?? ymd(new Date());

    const data = await getGSCData({ from, to });
    const meta = {
      from,
      to,
      cacheHit: !data._error,
      provider: "gsc" as const,
    };

    if (data._error) {
      // Return 200 with partial error so the UI can still render empty state.
      return successResponse({ _partialError: data._error, data, meta });
    }

    return successResponse({ data, meta });
  } catch (err) {
    return errorResponse(err);
  }
}
