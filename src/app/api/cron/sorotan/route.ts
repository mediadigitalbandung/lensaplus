/**
 * POST/GET /api/cron/sorotan
 *
 * Cron endpoint: generate missing Sorotan (3-angle AI summaries) for the N
 * oldest PUBLISHED articles that have no Sorotan yet. Cadence and batch
 * size are controlled from /panel/sorotan via SystemSetting so editors
 * can tune throughput without touching crontab.
 *
 * SystemSetting keys:
 *   sorotan_auto_enabled        "true" | "false"  default "false"
 *   sorotan_interval_minutes    5 | 10 | 15 | 20 | 30 | 60   default 60
 *   sorotan_batch_size          0..20             default 5
 *   sorotan_last_run_at         ISO timestamp     written internally
 *
 * Recommended VPS crontab: every 5 minutes — the throttle gate enforces
 * the editor's chosen cadence; batch_size = 0 is a "soft pause" that still
 * honors the toggle.
 *
 * Endpoint never throws — returns HTTP 200 with `{success, ...}` so cron
 * doesn't retry-spam.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSorotan } from "@/lib/seo/sorotan-generator";
import { verifyCronSecret, errorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function readSetting(key: string, fallback: string): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (!row || !row.value) return fallback;
    return row.value;
  } catch {
    return fallback;
  }
}

async function writeSetting(key: string, value: string): Promise<void> {
  try {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  } catch {
    /* swallow */
  }
}

function parseInterval(raw: string): number {
  const n = Number(raw);
  if ([5, 10, 15, 20, 30, 60].includes(n)) return n;
  return 60;
}

function parseBatch(raw: string): number {
  const n = Math.floor(Number(raw));
  if (Number.isNaN(n)) return 5;
  if (n < 0) return 0;
  if (n > 20) return 20;
  return n;
}

async function handler(req: NextRequest) {
  const started = Date.now();
  try {
    try { verifyCronSecret(req); } catch (e) { return errorResponse(e); }

    // 1. Toggle check
    const enabledStr = await readSetting("sorotan_auto_enabled", "false");
    if (enabledStr !== "true") {
      return NextResponse.json(
        { success: true, skipped: "disabled", durationMs: Date.now() - started },
        { status: 200 },
      );
    }

    // 2. Throttle: skip if not enough time since last run.
    const intervalMin = parseInterval(await readSetting("sorotan_interval_minutes", "60"));
    const batchSize = parseBatch(await readSetting("sorotan_batch_size", "5"));
    const lastRunIso = await readSetting("sorotan_last_run_at", "");
    const lastRunAt = lastRunIso ? new Date(lastRunIso) : null;
    const now = new Date();

    if (lastRunAt && !Number.isNaN(lastRunAt.getTime())) {
      const elapsedMin = (now.getTime() - lastRunAt.getTime()) / 60000;
      if (elapsedMin < intervalMin) {
        return NextResponse.json(
          {
            success: true,
            skipped: "throttled",
            intervalMinutes: intervalMin,
            elapsedMinutes: Math.round(elapsedMin * 10) / 10,
            nextRunIn: Math.round((intervalMin - elapsedMin) * 10) / 10,
            durationMs: Date.now() - started,
          },
          { status: 200 },
        );
      }
    }

    // 3. Stamp last_run_at FIRST so a flaky cron firing twice doesn't
    //    double-process the same articles.
    await writeSetting("sorotan_last_run_at", now.toISOString());

    if (batchSize === 0) {
      return NextResponse.json(
        {
          success: true,
          skipped: "batch-size-zero",
          intervalMinutes: intervalMin,
          batchSize: 0,
          durationMs: Date.now() - started,
        },
        { status: 200 },
      );
    }

    // 4. Pick batch — oldest published articles missing Sorotan first so we
    //    drain the backlog rather than re-processing recent ones.
    const candidates = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        sorotan: { none: {} },
      },
      orderBy: { publishedAt: "asc" },
      take: batchSize,
      select: { id: true, slug: true, title: true },
    });

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          success: true,
          skipped: "no-pending-articles",
          intervalMinutes: intervalMin,
          batchSize,
          durationMs: Date.now() - started,
        },
        { status: 200 },
      );
    }

    const results: Array<{
      articleId: string;
      slug: string;
      created: number;
      skipped: number;
      errors: string[];
    }> = [];
    const errors: string[] = [];

    for (const c of candidates) {
      try {
        const r = await generateSorotan(c.id);
        results.push({
          articleId: c.id,
          slug: c.slug,
          created: r.created,
          skipped: r.skipped,
          errors: r.errors,
        });
        if (r.errors.length > 0) {
          errors.push(`${c.slug}: ${r.errors.join(" | ")}`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${c.slug}: ${msg}`);
        results.push({
          articleId: c.id,
          slug: c.slug,
          created: 0,
          skipped: 0,
          errors: [msg],
        });
      }
    }

    const totalCreated = results.reduce((acc, r) => acc + r.created, 0);

    return NextResponse.json(
      {
        success: true,
        intervalMinutes: intervalMin,
        batchSize,
        processed: candidates.length,
        created: totalCreated,
        results,
        errors,
        durationMs: Date.now() - started,
      },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - started,
      },
      { status: 200 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
