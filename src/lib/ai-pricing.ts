/**
 * AI cost model — converts token usage (+ Perplexity per-request search fee) to
 * USD, and exposes the editor-settable USD→IDR rate for Rupiah reporting.
 *
 * Rates observed 2026-06-05 from official provider pricing:
 *   - Perplexity Sonar: docs.perplexity.ai/.../pricing (token + per-request search fee)
 *   - Anthropic / DeepSeek: public price lists (approximate; refine if needed)
 *
 * cost = inputTokens·inRate + outputTokens·outRate + perRequestSearchFee
 * USD→IDR conversion lives in lib/fx-rate.ts (live rate, frozen per usage row).
 */

type TokenRate = { input: number; output: number }; // USD per 1,000,000 tokens

// Perplexity Sonar token rates (USD / 1M tokens).
const PPLX_TOKEN: Record<string, TokenRate> = {
  sonar: { input: 1, output: 1 },
  "sonar-pro": { input: 3, output: 15 },
  "sonar-reasoning": { input: 1, output: 5 }, // legacy/unconfirmed — kept for safety
  "sonar-reasoning-pro": { input: 2, output: 8 },
  "sonar-deep-research": { input: 2, output: 8 }, // also has citation/reasoning/query fees (not modeled)
};

// Perplexity per-request search fee (USD / 1000 requests) by model + context size.
const PPLX_REQUEST: Record<string, { low: number; medium: number; high: number }> = {
  sonar: { low: 5, medium: 8, high: 12 },
  "sonar-pro": { low: 6, medium: 10, high: 14 },
  "sonar-reasoning": { low: 5, medium: 8, high: 12 },
  "sonar-reasoning-pro": { low: 6, medium: 10, high: 14 },
  "sonar-deep-research": { low: 6, medium: 10, high: 14 },
};

// Anthropic + DeepSeek token rates (USD / 1M tokens) — approximate (2026-06).
const OTHER_TOKEN: Record<string, TokenRate> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-opus-4-5": { input: 15, output: 75 },
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
};

function lookupByPrefix<T>(table: Record<string, T>, model: string): T | null {
  if (table[model]) return table[model];
  const stripped = model.replace(/-\d{8}$/, "");
  if (table[stripped]) return table[stripped];
  const sortedKeys = Object.keys(table).sort((a, b) => b.length - a.length);
  const matchedKey = sortedKeys.find((key) => stripped.startsWith(key));
  return matchedKey ? table[matchedKey] : null;
}

function lookupTokenRate(
  table: Record<string, TokenRate>,
  model: string,
): TokenRate | null {
  const direct = lookupByPrefix(table, model);
  if (direct) return direct;
  const stripped = model.replace(/-\d{8}$/, "");
  if (stripped.startsWith("claude-haiku")) return table["claude-haiku-4-5"];
  if (stripped.startsWith("claude-sonnet")) return table["claude-sonnet-4-6"];
  if (stripped.startsWith("claude-opus")) return table["claude-opus-4-6"];
  return null;
}

/** Compute the USD cost of a single AI call. Returns 0 if the model is unknown. */
export function computeCostUsd(p: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  searchContext?: string | null;
}): number {
  const isPplx = p.provider === "perplexity";
  const table = isPplx ? PPLX_TOKEN : OTHER_TOKEN;
  const rate = lookupTokenRate(table, p.model) || (isPplx ? PPLX_TOKEN.sonar : null);
  if (!rate) return 0;

  let cost = (p.inputTokens / 1e6) * rate.input + (p.outputTokens / 1e6) * rate.output;

  if (isPplx) {
    const req = lookupByPrefix(PPLX_REQUEST, p.model) ?? PPLX_REQUEST.sonar;
    const ctx = p.searchContext === "low" || p.searchContext === "medium" || p.searchContext === "high" ? p.searchContext : "high";
    cost += req[ctx] / 1000; // flat per-request search fee
  }
  return cost;
}
