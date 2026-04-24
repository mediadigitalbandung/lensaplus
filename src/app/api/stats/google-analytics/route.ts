/**
 * GET /api/stats/google-analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns GA4 Data API aggregates + top pages + daily trend.
 * Auth: EDITOR+
 *
 * If credentials are missing or the API call fails, responds HTTP 200 with
 * `{ success: false, error, data: <empty struct> }` so the UI doesn't crash.
 */

import { NextResponse } from "next/server";
import { errorResponse, requireRole } from "@/lib/api-utils";
import { getGA4Data } from "@/lib/stats/google-analytics";

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

    const data = await getGA4Data({ from, to });
    const cacheHit = !data._error && !("fresh" in data);
    const meta = { from, to, cacheHit, provider: "ga4" as const };

    if (data._error) {
      return NextResponse.json(
        {
          success: false,
          error: data._error,
          data,
          meta,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { success: true, data, meta },
      { status: 200 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
