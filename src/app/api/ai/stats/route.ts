/**
 * GET /api/ai/stats  — SUPER_ADMIN only.
 * Cost analytics over AIUsageLog: total tokens & cost (Rupiah), and PER-ARTICLE
 * aggregation (one article = sum of all AI calls attributed to its title) with
 * average / min / max tokens & Rupiah.
 *
 * Rupiah is the FROZEN per-row `costIdr` (the rate at the moment of use), so
 * historical spend never changes when the rupiah moves. Legacy rows logged
 * before costIdr existed fall back to costUsd × the current live rate.
 *
 * Optional ?provider=perplexity|anthropic|deepseek to scope to one provider.
 */
import { NextRequest } from "next/server";
import { requireRole, successResponse, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getUsdIdrRate, isUsdIdrManual } from "@/lib/fx-rate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const providerFilter = new URL(req.url).searchParams.get("provider") || undefined;
    const where = providerFilter ? { provider: providerFilter } : {};

    const [currentRate, manual, logs] = await Promise.all([
      getUsdIdrRate(),
      isUsdIdrManual(),
      prisma.aIUsageLog.findMany({
        where,
        select: {
          feature: true, provider: true, model: true,
          totalTokens: true, costUsd: true, costIdr: true, articleTitle: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Frozen Rupiah per row; legacy rows (no costIdr) estimated at the current rate.
    const rowIdr = (l: { costIdr: number | null; costUsd: number | null }) =>
      l.costIdr ?? Math.round((l.costUsd ?? 0) * currentRate);

    const totalRequests = logs.length;
    const totalTokens = logs.reduce((s, l) => s + l.totalTokens, 0);
    const totalCostUsd = logs.reduce((s, l) => s + (l.costUsd ?? 0), 0);
    const totalCostIdr = logs.reduce((s, l) => s + rowIdr(l), 0);

    // ── Per-article aggregation (articleTitle = attribution key) ──────────────
    const artMap = new Map<string, { title: string; calls: number; tokens: number; costIdr: number; providers: Set<string> }>();
    for (const l of logs) {
      const t = (l.articleTitle ?? "").trim();
      if (!t) continue;
      let a = artMap.get(t);
      if (!a) { a = { title: t, calls: 0, tokens: 0, costIdr: 0, providers: new Set() }; artMap.set(t, a); }
      a.calls += 1;
      a.tokens += l.totalTokens;
      a.costIdr += rowIdr(l);
      if (l.provider) a.providers.add(l.provider);
    }
    const articles = Array.from(artMap.values()).map((a) => ({
      title: a.title,
      calls: a.calls,
      tokens: a.tokens,
      costIdr: a.costIdr,
      providers: Array.from(a.providers),
    }));

    // avg / min / max ACROSS per-article totals
    const n = articles.length;
    const tokensArr = articles.map((a) => a.tokens);
    const idrArr = articles.map((a) => a.costIdr);
    const sum = (arr: number[]) => arr.reduce((s, x) => s + x, 0);
    const perArticle = n > 0
      ? {
          count: n,
          avgTokens: Math.round(sum(tokensArr) / n),
          minTokens: Math.min(...tokensArr),
          maxTokens: Math.max(...tokensArr),
          avgCostIdr: Math.round(sum(idrArr) / n),
          minCostIdr: Math.min(...idrArr),
          maxCostIdr: Math.max(...idrArr),
        }
      : { count: 0, avgTokens: 0, minTokens: 0, maxTokens: 0, avgCostIdr: 0, minCostIdr: 0, maxCostIdr: 0 };

    // ── Breakdown by provider / model / feature (frozen IDR) ──────────────────
    const groupBy = (pick: (l: (typeof logs)[number]) => string) => {
      const m = new Map<string, { tokens: number; costIdr: number; requests: number }>();
      for (const l of logs) {
        const k = pick(l) || "unknown";
        let g = m.get(k);
        if (!g) { g = { tokens: 0, costIdr: 0, requests: 0 }; m.set(k, g); }
        g.tokens += l.totalTokens;
        g.costIdr += rowIdr(l);
        g.requests += 1;
      }
      return Array.from(m.entries())
        .map(([key, v]) => ({ key, tokens: v.tokens, costIdr: v.costIdr, requests: v.requests }))
        .sort((a, b) => b.costIdr - a.costIdr);
    };

    const topArticles = Array.from(articles).sort((a, b) => b.costIdr - a.costIdr).slice(0, 25);

    return successResponse({
      usdIdrRate: currentRate, // current live rate (for display only)
      usdIdrManual: manual, // true = pinned via Pengaturan; false = auto/live
      totals: { totalRequests, totalTokens, totalCostUsd, totalCostIdr },
      perArticle,
      byProvider: groupBy((l) => l.provider ?? "unknown"),
      byModel: groupBy((l) => l.model ?? "unknown"),
      byFeature: groupBy((l) => l.feature),
      topArticles,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
