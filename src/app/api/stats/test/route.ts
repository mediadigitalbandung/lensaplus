/**
 * GET /api/stats/test
 *
 * Lightweight health-check for the GA4 + GSC integrations. Hits both
 * services with a 1-day window so SUPER_ADMIN can verify credentials are
 * configured & working without leaving the panel.
 *
 * Auth: SUPER_ADMIN only (returns service-account / property-ID hints).
 *
 * Always responds HTTP 200 with `{ok: boolean, error?, ...}` per service so
 * the UI can render a green/red dot per row without try/catch fanout.
 */

import { NextResponse } from "next/server";
import { errorResponse, requireRole } from "@/lib/api-utils";
import { getGA4Data } from "@/lib/stats/google-analytics";
import { getGSCData } from "@/lib/stats/google-search";

export const dynamic = "force-dynamic";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface ServiceProbe {
  ok: boolean;
  error?: string;
  rowCount?: number;
  durationMs: number;
}

async function probeGA4(from: string, to: string): Promise<ServiceProbe> {
  const start = Date.now();
  try {
    const data = await getGA4Data({ from, to });
    if (data._error) {
      return { ok: false, error: data._error, durationMs: Date.now() - start };
    }
    // Treat any successful response as healthy. dailyTrend may be empty for
    // brand-new properties; that still proves credentials work.
    return {
      ok: true,
      rowCount: data.dailyTrend?.length ?? 0,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, durationMs: Date.now() - start };
  }
}

async function probeGSC(from: string, to: string): Promise<ServiceProbe> {
  const start = Date.now();
  try {
    const data = await getGSCData({ from, to });
    if (data._error) {
      return { ok: false, error: data._error, durationMs: Date.now() - start };
    }
    return {
      ok: true,
      rowCount: data.dailyTrend?.length ?? 0,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, durationMs: Date.now() - start };
  }
}

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);

    // 1-day window — yesterday → today. Cheapest possible call to each API.
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const from = ymd(yesterday);
    const to = ymd(today);

    const [ga4, gsc] = await Promise.all([
      probeGA4(from, to),
      probeGSC(from, to),
    ]);

    return NextResponse.json(
      {
        success: ga4.ok && gsc.ok,
        window: { from, to },
        services: { ga4, gsc },
      },
      { status: 200 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
