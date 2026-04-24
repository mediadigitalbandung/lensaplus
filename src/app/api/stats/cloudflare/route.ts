/**
 * GET /api/stats/cloudflare?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns Cloudflare GraphQL analytics (requests, bandwidth, cache, threats).
 * Auth: EDITOR+
 *
 * If credentials are missing or the API call fails, responds HTTP 200 with
 * `{ success: false, error, data: <empty struct> }` so the UI doesn't crash.
 */

import { NextResponse } from "next/server";
import { errorResponse, requireRole } from "@/lib/api-utils";
import { getCloudflareAnalytics } from "@/lib/stats/cloudflare";

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

    const data = await getCloudflareAnalytics({ from, to });
    const meta = {
      from,
      to,
      cacheHit: !data._error,
      provider: "cloudflare" as const,
    };

    if (data._error) {
      return NextResponse.json(
        { success: false, error: data._error, data, meta },
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
