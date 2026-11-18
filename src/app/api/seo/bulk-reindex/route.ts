/**
 * POST /api/seo/bulk-reindex
 *
 * Priority-aware bulk re-indexing for Google Indexing API (200/day limit) + IndexNow:
 *   1. Main articles (`Article`, `/berita/*`) are ALWAYS prioritized first.
 *   2. Sorotan (`Sorotan`, `/sorotan/*`) are ONLY submitted after all pending
 *      main articles have been submitted and daily quota still has remaining slots.
 *
 * Body (optional): { mode?: "priority_all" | "articles_only" | "sorotan_remaining" }
 *   - "priority_all" (default): mark all published Articles + Sorotan as "pending",
 *     submit main articles first, then Sorotan if all main articles finish and quota remains.
 *   - "articles_only": mark all published Articles as "pending" and submit main articles only.
 *   - "sorotan_remaining": keep existing Article submission states, finish any pending
 *     main articles first, then use remaining daily quota (out of 200/day) for Sorotan.
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  errorResponse,
  requireRole,
  successResponse,
  logAudit,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { runPrioritizedIndexingBatch } from "@/lib/seo/indexing-priority";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";
const IMMEDIATE_SUBMIT_CAP = 80;

const bodySchema = z
  .object({
    mode: z
      .enum(["priority_all", "articles_only", "sorotan_remaining"])
      .optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole([
      "SUPER_ADMIN",
      "CHIEF_EDITOR",
      "EDITOR",
    ]);

    let mode: "priority_all" | "articles_only" | "sorotan_remaining" =
      "priority_all";
    try {
      const rawBody = await req.json();
      const parsed = bodySchema.parse(rawBody);
      if (parsed?.mode) {
        mode = parsed.mode;
      }
    } catch {
      // Empty body is valid and defaults to "priority_all"
    }

    let markedArticles = 0;
    let markedSorotan = 0;

    if (mode === "priority_all") {
      const [updatedArticles, updatedSorotan] = await Promise.all([
        prisma.article.updateMany({
          where: { status: "PUBLISHED" },
          data: { indexStatus: "pending", indexLastError: null },
        }),
        prisma.sorotan.updateMany({
          where: { article: { status: "PUBLISHED" } },
          data: { indexStatus: "pending", indexLastError: null },
        }),
      ]);
      markedArticles = updatedArticles.count;
      markedSorotan = updatedSorotan.count;
    } else if (mode === "articles_only") {
      const updatedArticles = await prisma.article.updateMany({
        where: { status: "PUBLISHED" },
        data: { indexStatus: "pending", indexLastError: null },
      });
      markedArticles = updatedArticles.count;
    } else {
      // mode === "sorotan_remaining": clear failed sorotan so they can retry with remaining quota
      const updatedSorotan = await prisma.sorotan.updateMany({
        where: {
          article: { status: "PUBLISHED" },
          indexStatus: "failed",
        },
        data: { indexStatus: "pending", indexLastError: null },
      });
      markedSorotan = updatedSorotan.count;
    }

    const batch = await runPrioritizedIndexingBatch({
      includePendingArticles: true,
      includePendingSorotan: mode !== "articles_only",
      includeFailedRetries: mode === "sorotan_remaining",
      maxArticleBatch: IMMEDIATE_SUBMIT_CAP,
      maxSorotanBatch: IMMEDIATE_SUBMIT_CAP,
      maxTotalBatch: IMMEDIATE_SUBMIT_CAP,
      siteUrl: SITE_URL,
    });

    const submittedNow = batch.articles.succeeded;
    const sorotanSubmittedNow = batch.sorotan.succeeded;
    const failedNow = batch.articles.failed;
    const remainingPending = batch.articles.remainingPending;

    let note = "";
    if (mode === "sorotan_remaining") {
      if (sorotanSubmittedNow > 0) {
        note =
          submittedNow > 0
            ? `${submittedNow} artikel utama diselesaikan lebih dulu, lalu ${sorotanSubmittedNow} sorotan dikirim menggunakan sisa kuota (${batch.quota.remaining} kuota tersisa hari ini).`
            : `${sorotanSubmittedNow} sorotan berhasil dikirim menggunakan sisa kuota Google Indexing (${batch.quota.remaining} kuota tersisa hari ini).`;
      } else if (remainingPending > 0) {
        note = `${submittedNow} artikel utama dikirim. Sorotan belum dikirim karena masih ada ${remainingPending} artikel utama dalam antrean prioritas.`;
      } else if (batch.quota.remaining <= 0) {
        note = `Kuota harian Google Indexing (${batch.quota.limit}/hari) sudah habis terpakai. Sorotan tetap dalam antrean untuk kuota esok hari.`;
      } else {
        note = "Tidak ada antrean sorotan pending untuk dikirim.";
      }
    } else if (remainingPending > 0) {
      note = `${submittedNow} artikel utama langsung dikirim; ${remainingPending} artikel utama dan seluruh sorotan menunggu giliran sesuai prioritas kuota 200/hari.`;
    } else if (sorotanSubmittedNow > 0) {
      note = `Seluruh ${submittedNow} artikel utama selesai dikirim lebih dulu, dilanjutkan ${sorotanSubmittedNow} sorotan menggunakan sisa kuota harian.`;
    } else {
      note = `${submittedNow} artikel utama langsung dikirim ke Google Indexing & IndexNow.`;
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(
      session.user.id,
      "SEO_BULK_REINDEX",
      "Article",
      mode,
      JSON.stringify({
        mode,
        marked: markedArticles,
        markedSorotan,
        submittedNow,
        sorotanSubmittedNow,
        failedNow,
        remainingPending,
        quotaRemaining: batch.quota.remaining,
      }),
      ip,
    );

    return successResponse({
      mode,
      marked: markedArticles,
      markedSorotan,
      submittedNow,
      sorotanSubmittedNow,
      failedNow,
      remainingPending,
      articles: batch.articles,
      sorotan: batch.sorotan,
      quota: batch.quota,
      indexNow: batch.indexNow,
      note,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
