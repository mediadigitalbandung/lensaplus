import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import { decryptSecret } from "./crypto-secrets";
import { recordAiUsage } from "./ai-usage";

/**
 * Shared AI client for Kartawarta.
 * Primary provider: Anthropic Claude Haiku 4.5.
 * Fallback: DeepSeek (deepseek-chat).
 *
 * Usage:
 *   const { text } = await callAI({
 *     feature: "article_draft",
 *     userPrompt: "Tulis draft artikel...",
 *     userId: session.user.id,
 *   });
 */

export type AIFeature =
  | "article_draft"
  | "seo_title"
  | "seo_description"
  | "sorotan"
  | "faq"
  | "social_caption"
  | "tag_research"
  | "bulk_tags"
  | "polling"
  | "clip_selection"
  | "test";

export interface CallAIOptions {
  feature: AIFeature;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  userId?: string;
  articleTitle?: string;
  forceProvider?: "anthropic" | "deepseek";
  /** Override the 60s default per-call timeout (ms). */
  timeoutMs?: number;
}

export interface CallAIResult {
  text: string;
  provider: "anthropic" | "deepseek";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
}

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TIMEOUT_MS = 60_000;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_SYSTEM_PROMPT =
  "Kamu adalah asisten AI untuk Kartawarta — media berita digital Bandung dengan fokus bisnis, ekonomi, pemerintahan, dan hukum, plus topik general (olahraga, hiburan, teknologi, pendidikan, kesehatan, lingkungan). Jawab dalam Bahasa Indonesia.";

type Provider = "anthropic" | "deepseek";

/**
 * Decide whether an Anthropic error should trigger DeepSeek fallback.
 *
 * Retryable (fallback OK): transient network/server failures, auth/quota
 * issues that won't be different on a fresh call to the same provider.
 *
 * Not retryable (re-throw): 400 Bad Request — the prompt itself is malformed,
 * so DeepSeek will likely fail the same way and we'd be paying for a useless
 * second call (and risking generation of misleading output).
 */
export function isRetryable(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);

  // 400 Bad Request — prompt-level issue. Do NOT fallback.
  // Match early so it wins over the broad 4xx-ish patterns below.
  if (/\b400\b|bad request|invalid prompt|invalid_request_error/i.test(msg)) {
    return false;
  }

  // Network / aborted / timeout — retry.
  if (/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(msg)) {
    return true;
  }
  if (/AbortError|aborted|timeout|timed out/i.test(msg)) return true;

  // 5xx server-side — retry.
  if (/\b50\d\b|internal server error|service unavailable|bad gateway|gateway timeout/i.test(msg)) {
    return true;
  }

  // 401/403 — token issue. DeepSeek has its own key, so fallback is meaningful.
  if (/\b401\b|\b403\b|invalid api key|unauthorized|forbidden|authentication/i.test(msg)) {
    return true;
  }

  // 429 — rate limit / quota. Fallback to DeepSeek is the whole point.
  if (/\b429\b|rate limit|rate_limit|quota|overloaded/i.test(msg)) {
    return true;
  }

  // Unknown / SDK-internal — conservatively retry.
  return true;
}

/**
 * Read API key for a provider from SystemSetting, fallback to env var.
 * Returns null if neither source has a value.
 */
async function getApiKey(provider: Provider): Promise<string | null> {
  const settingKey =
    provider === "anthropic" ? "anthropic_api_key" : "deepseek_api_key";
  const envKey =
    provider === "anthropic" ? "ANTHROPIC_API_KEY" : "DEEPSEEK_API_KEY";

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: settingKey },
    });
    if (setting?.value && setting.value.trim().length > 0) {
      return decryptSecret(setting.value.trim());
    }
  } catch {
    // DB unavailable — fall through to env fallback.
  }

  const envValue = process.env[envKey];
  if (envValue && envValue.trim().length > 0) {
    return envValue.trim();
  }
  return null;
}

/**
 * Call Anthropic Claude via official SDK.
 */
async function callAnthropic(
  opts: CallAIOptions,
  apiKey: string,
): Promise<CallAIResult> {
  const client = new Anthropic({ apiKey });
  const start = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: ANTHROPIC_MODEL,
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
        system: opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: opts.userPrompt }],
      },
      { signal: controller.signal },
    );

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      }
    }

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    return {
      text: text.trim(),
      provider: "anthropic",
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      durationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call DeepSeek via raw fetch (OpenAI-compatible endpoint).
 */
async function callDeepSeek(
  opts: CallAIOptions,
  apiKey: string,
): Promise<CallAIResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: "system",
            content: opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
          },
          { role: "user", content: opts.userPrompt },
        ],
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `DeepSeek HTTP ${response.status}: ${body.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;

    return {
      text,
      provider: "deepseek",
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      durationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fire-and-forget log to AIUsageLog. Errors are swallowed — logging must
 * never block or fail the caller.
 */
function logUsage(opts: CallAIOptions, result: CallAIResult): void {
  const model = result.provider === "anthropic" ? ANTHROPIC_MODEL : DEEPSEEK_MODEL;
  // Route through the shared chokepoint so these rows ALSO get a frozen costIdr +
  // usdIdrRate (previously only Perplexity rows did), keeping the AI stats'
  // historical Rupiah consistent across providers. Fire-and-forget inside.
  recordAiUsage({
    userId: opts.userId ?? "system",
    userName: opts.userId ? "user" : "system",
    feature: opts.feature,
    provider: result.provider,
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.totalTokens,
    articleTitle: opts.articleTitle,
  });
}

/**
 * Main entry point. Try Anthropic first, fall back to DeepSeek on any failure.
 * If `forceProvider` is set, skip the fallback path and call only that provider.
 */
export async function callAI(opts: CallAIOptions): Promise<CallAIResult> {
  // Forced provider path — no fallback.
  if (opts.forceProvider === "anthropic") {
    const key = await getApiKey("anthropic");
    if (!key) {
      throw new Error(
        "AI provider 'anthropic' forced but no API key configured",
      );
    }
    const result = await callAnthropic(opts, key);
    logUsage(opts, result);
    return result;
  }
  if (opts.forceProvider === "deepseek") {
    const key = await getApiKey("deepseek");
    if (!key) {
      throw new Error(
        "AI provider 'deepseek' forced but no API key configured",
      );
    }
    const result = await callDeepSeek(opts, key);
    logUsage(opts, result);
    return result;
  }

  // Default path: Anthropic primary, DeepSeek fallback.
  const [anthropicKey, deepseekKey] = await Promise.all([
    getApiKey("anthropic"),
    getApiKey("deepseek"),
  ]);

  const errors: string[] = [];

  if (anthropicKey) {
    try {
      const result = await callAnthropic(opts, anthropicKey);
      logUsage(opts, result);
      return result;
    } catch (err) {
      // If the error is non-retryable (e.g. 400 Bad Request from a malformed
      // prompt), don't waste a DeepSeek call — the prompt would fail there
      // too and the response would be misleading. Re-throw immediately.
      if (!isRetryable(err)) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`anthropic: ${msg}`);
    }
  } else {
    errors.push("anthropic: no API key configured");
  }

  if (deepseekKey) {
    try {
      const result = await callDeepSeek(opts, deepseekKey);
      logUsage(opts, result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`deepseek: ${msg}`);
    }
  } else {
    errors.push("deepseek: no API key configured");
  }

  throw new Error(`AI providers exhausted: ${errors.join("; ")}`);
}
