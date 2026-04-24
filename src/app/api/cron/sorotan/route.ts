/**
 * POST/GET /api/cron/sorotan
 *
 * Cron endpoint: generate missing Sorotan (3-angle AI summaries) for
 * the 5 most recent PUBLISHED articles that have no Sorotan yet.
 * Protected by `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Recommend invocation: every 6 hours.
 *
 * Endpoint never throws — it returns HTTP 200 with `{success, errors[]}`
 * so crontab doesn't retry-spam.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSorotan } from "@/lib/seo/sorotan-generator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 5;

async function handler(req: NextRequest) {
  const started = Date.now();
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const candidates = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        sorotan: { none: {} },
      },
      orderBy: { publishedAt: "desc" },
      take: BATCH_SIZE,
      select: { id: true, slug: true, title: true },
    });

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
