import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";

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
  "Kamu adalah asisten AI untuk media berita hukum Indonesia. Jawab dalam Bahasa Indonesia.";

type Provider = "anthropic" | "deepseek";

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
      return setting.value.trim();
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
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

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
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

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
  void prisma.aIUsageLog
    .create({
      data: {
        userId: opts.userId ?? "system",
        userName: opts.userId ? "user" : "system",
        feature: opts.feature,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        articleTitle: opts.articleTitle,
      },
    })
    .catch(() => {
      // swallow — never block caller on logging
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
