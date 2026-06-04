/**
 * recordAiUsage — single chokepoint for writing an AIUsageLog row with a
 * computed USD cost. Fire-and-forget: never throws, never blocks the caller
 * (telemetry must not break AI features). Used by the Perplexity routes and
 * the Claude/DeepSeek client (ai-client.ts).
 */

import { prisma } from "./prisma";
import { computeCostUsd } from "./ai-pricing";
import { getUsdIdrRate } from "./fx-rate";

export interface RecordAiUsageInput {
  userId: string;
  userName: string;
  feature: string;
  provider: string; // "perplexity" | "anthropic" | "deepseek"
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
  searchContext?: string | null;
  articleTitle?: string | null;
}

export function recordAiUsage(input: RecordAiUsageInput): void {
  // Fire-and-forget: callers never await. We compute the USD cost, FREEZE it to
  // Rupiah at the rate in effect right now, and store both the IDR amount and
  // the rate used — so this row's cost never changes when the rupiah moves later.
  void (async () => {
    const totalTokens = input.totalTokens ?? input.inputTokens + input.outputTokens;
    const costUsd = computeCostUsd({
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      searchContext: input.searchContext,
    });
    const usdIdrRate = await getUsdIdrRate();
    const costIdr = Math.round(costUsd * usdIdrRate);

    await prisma.aIUsageLog.create({
      data: {
        userId: input.userId || "system",
        userName: input.userName || "system",
        feature: input.feature,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens,
        provider: input.provider,
        model: input.model,
        costUsd,
        costIdr,
        usdIdrRate,
        searchContext: input.searchContext ?? undefined,
        articleTitle: input.articleTitle ?? undefined,
      },
    });
  })().catch(() => {
    // swallow — telemetry must never block or fail the caller
  });
}
