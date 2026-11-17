import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import { decryptSecret } from "./crypto-secrets";
import { recordAiUsage } from "./ai-usage";

/**
 * Shared AI client for Lensaplus.
 * Supports Anthropic Claude and DeepSeek with configurable primary provider,
 * per-provider models, writing instructions, token/sampling controls, and
 * optional 2-stage DeepSeek Combo mode.
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

export const DEEPSEEK_MODELS = ["deepseek-chat", "deepseek-reasoner"] as const;
export const ANTHROPIC_MODELS = [
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-opus-4-6",
] as const;

export interface CallAIOptions {
  feature: AIFeature;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  userId?: string;
  userName?: string;
  articleTitle?: string;
  forceProvider?: "anthropic" | "deepseek";
  /** Allow 2-stage Combo mode when configured (only for long/full drafts). */
  allowCombo?: boolean;
  /** Skip custom global author persona instructions (e.g. smoke tests). */
  skipInstructions?: boolean;
  /** Override the 60s default per-call timeout (ms). */
  timeoutMs?: number;
}

export interface CallAIResult {
  text: string;
  provider: "anthropic" | "deepseek";
  model?: string;
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
  "Kamu adalah asisten AI untuk Lensaplus — media berita digital Bandung dengan fokus bisnis, ekonomi, pemerintahan, dan hukum, plus topik general (olahraga, hiburan, teknologi, pendidikan, kesehatan, lingkungan). Jawab dalam Bahasa Indonesia.";

const DEEPSEEK_STAGE1_SYSTEM =
  "Anda analis editorial redaksi Lensaplus. Dari instruksi/bahan berikut, susun kerangka analisis singkat dalam poin-poin padat: sudut pandang berita utama, fakta/angka/kutipan kunci yang harus dipertahankan, dan struktur alur penulisan. Jangan menulis draf lengkap, cukup kerangka padat dan akurat.";

type Provider = "anthropic" | "deepseek";
type SettingsDict = Record<string, string>;

const CONFIG_SETTING_KEYS = [
  "enable_ai",
  "ai_primary_provider",
  "anthropic_instructions",
  "anthropic_model",
  "anthropic_max_tokens",
  "anthropic_temperature",
  "deepseek_instructions",
  "deepseek_model",
  "deepseek_max_tokens",
  "deepseek_temperature",
  "deepseek_top_p",
  "deepseek_frequency_penalty",
  "deepseek_combo_enabled",
  "deepseek_research_model",
] as const;

interface DeepSeekConfig {
  model: string;
  researchModel: string;
  comboEnabled: boolean;
  instructions: string;
  maxTokensCap: number | null;
  temperature: number | null;
  topP: number | null;
  frequencyPenalty: number | null;
}

interface AnthropicConfig {
  model: string;
  instructions: string;
  maxTokensCap: number | null;
  temperature: number | null;
}

async function readSettingsMap(keys: readonly string[]): Promise<SettingsDict> {
  try {
    const ss = prisma.systemSetting as unknown as {
      findMany?: (args: { where: { key: { in: string[] } }; select?: { key: boolean; value: boolean } }) => Promise<Array<{ key: string; value: string }>>;
      findUnique?: (args: { where: { key: string } }) => Promise<{ key: string; value: string } | null>;
    };
    if (typeof ss.findMany === "function") {
      const rows = await ss.findMany({
        where: { key: { in: [...keys] } },
        select: { key: true, value: true },
      });
      return Object.fromEntries(rows.map((r) => [r.key, (r.value ?? "").trim()]));
    }
    if (typeof ss.findUnique === "function") {
      const settled = await Promise.all(
        keys.map((key) => ss.findUnique!({ where: { key } }).catch(() => null)),
      );
      const out: SettingsDict = {};
      for (const row of settled) {
        if (row?.key) out[row.key] = (row.value ?? "").trim();
      }
      return out;
    }
  } catch {
    // DB unavailable — fall back to defaults.
  }
  return {};
}

function parseOptionalIntCap(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseOptionalFloat(raw: string | undefined, min: number, max: number): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function getDeepSeekConfig(map: SettingsDict): DeepSeekConfig {
  const model = (DEEPSEEK_MODELS as readonly string[]).includes(map.deepseek_model)
    ? map.deepseek_model
    : DEEPSEEK_MODEL;
  const researchModel = (DEEPSEEK_MODELS as readonly string[]).includes(map.deepseek_research_model)
    ? map.deepseek_research_model
    : "deepseek-reasoner";
  return {
    model,
    researchModel,
    comboEnabled: map.deepseek_combo_enabled === "true",
    instructions: (map.deepseek_instructions ?? "").trim(),
    maxTokensCap: parseOptionalIntCap(map.deepseek_max_tokens),
    temperature: parseOptionalFloat(map.deepseek_temperature, 0, 2),
    topP: parseOptionalFloat(map.deepseek_top_p, 0.01, 1),
    frequencyPenalty: parseOptionalFloat(map.deepseek_frequency_penalty, -2, 2),
  };
}

function getAnthropicConfig(map: SettingsDict): AnthropicConfig {
  const model = (ANTHROPIC_MODELS as readonly string[]).includes(map.anthropic_model)
    ? map.anthropic_model
    : ANTHROPIC_MODEL;
  return {
    model,
    instructions: (map.anthropic_instructions ?? "").trim(),
    maxTokensCap: parseOptionalIntCap(map.anthropic_max_tokens),
    temperature: parseOptionalFloat(map.anthropic_temperature, 0, 1),
  };
}

function buildSystemPrompt(
  base: string | undefined,
  instructions: string,
  skip?: boolean,
): string {
  const prompt = base ?? DEFAULT_SYSTEM_PROMPT;
  if (skip || !instructions) return prompt;
  return `${prompt}\n\nARAHAN PENULIS (WAJIB DIIKUTI): ${instructions}\n(Tetap patuhi format output yang diminta di atas.)`;
}

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
  cfg: AnthropicConfig,
): Promise<CallAIResult> {
  const client = new Anthropic({ apiKey });
  const start = Date.now();
  const skipMeta = opts.skipInstructions || opts.feature === "test";
  const requestedMax = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const maxTokens =
    !skipMeta && cfg.maxTokensCap
      ? Math.min(requestedMax, cfg.maxTokensCap)
      : requestedMax;
  const temperature =
    !skipMeta && cfg.temperature !== null
      ? cfg.temperature
      : opts.temperature ?? DEFAULT_TEMPERATURE;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: cfg.model,
        max_tokens: maxTokens,
        temperature,
        system: buildSystemPrompt(opts.systemPrompt, cfg.instructions, skipMeta),
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
      model: cfg.model,
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
 * Single HTTP request to DeepSeek chat completions.
 */
async function runDeepSeekOnce(p: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  topP: number | null;
  frequencyPenalty: number | null;
  timeoutMs: number;
}): Promise<CallAIResult> {
  const start = Date.now();
  const isReasoner = p.model === "deepseek-reasoner";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), p.timeoutMs);

  const payload: Record<string, unknown> = {
    model: p.model,
    messages: [
      { role: "system", content: p.systemPrompt },
      { role: "user", content: p.userPrompt },
    ],
    max_tokens: p.maxTokens,
  };
  if (!isReasoner) {
    payload.temperature = p.temperature;
    if (p.topP !== null) payload.top_p = p.topP;
    if (p.frequencyPenalty !== null) payload.frequency_penalty = p.frequencyPenalty;
  }

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.apiKey}`,
      },
      body: JSON.stringify(payload),
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
      model: p.model,
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
 * Call DeepSeek (supporting custom model, author instructions, token cap,
 * sampling controls, and optional 2-stage Combo mode).
 */
async function callDeepSeek(
  opts: CallAIOptions,
  apiKey: string,
  cfg: DeepSeekConfig,
): Promise<{ result: CallAIResult; loggedAlready: boolean }> {
  const skipMeta = opts.skipInstructions || opts.feature === "test";
  const requestedMax = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const cappedMax =
    !skipMeta && cfg.maxTokensCap
      ? Math.min(requestedMax, cfg.maxTokensCap)
      : requestedMax;
  const baseTemperature =
    !skipMeta && cfg.temperature !== null
      ? cfg.temperature
      : opts.temperature ?? DEFAULT_TEMPERATURE;

  const shouldCombo =
    Boolean(opts.allowCombo) && cfg.comboEnabled && !skipMeta;

  if (shouldCombo) {
    const stage1Max = cfg.researchModel === "deepseek-reasoner" ? 1600 : 700;
    const stage1 = await runDeepSeekOnce({
      apiKey,
      model: cfg.researchModel,
      systemPrompt: DEEPSEEK_STAGE1_SYSTEM,
      userPrompt: opts.userPrompt,
      maxTokens: stage1Max,
      temperature: 0.3,
      topP: cfg.topP,
      frequencyPenalty: cfg.frequencyPenalty,
      timeoutMs: Math.max(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, 90_000),
    });
    logUsage(opts, {
      ...stage1,
      model: cfg.researchModel,
    });

    const stage2Max =
      cfg.model === "deepseek-reasoner"
        ? Math.max(cappedMax, 1500)
        : cappedMax;
    const stage2 = await runDeepSeekOnce({
      apiKey,
      model: cfg.model,
      systemPrompt: buildSystemPrompt(opts.systemPrompt, cfg.instructions, false),
      userPrompt:
        `KERANGKA ANALISIS (TAHAP 1 — WAJIB DIPERTAHANKAN AKURASINYA):\n${stage1.text}\n\n` +
        `TUGAS PENULISAN (TAHAP 2):\n${opts.userPrompt}`,
      maxTokens: stage2Max,
      temperature: baseTemperature,
      topP: cfg.topP,
      frequencyPenalty: cfg.frequencyPenalty,
      timeoutMs: Math.max(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, 90_000),
    });
    logUsage(opts, {
      ...stage2,
      model: cfg.model,
    });

    return {
      result: {
        text: stage2.text,
        provider: "deepseek",
        model: `${cfg.researchModel}+${cfg.model}`,
        inputTokens: stage1.inputTokens + stage2.inputTokens,
        outputTokens: stage1.outputTokens + stage2.outputTokens,
        totalTokens: stage1.totalTokens + stage2.totalTokens,
        durationMs: stage1.durationMs + stage2.durationMs,
      },
      loggedAlready: true,
    };
  }

  const effectiveMax =
    cfg.model === "deepseek-reasoner"
      ? Math.max(cappedMax, opts.feature === "test" ? 512 : 1500)
      : cappedMax;

  const single = await runDeepSeekOnce({
    apiKey,
    model: cfg.model,
    systemPrompt: buildSystemPrompt(opts.systemPrompt, cfg.instructions, skipMeta),
    userPrompt: opts.userPrompt,
    maxTokens: effectiveMax,
    temperature: baseTemperature,
    topP: skipMeta ? null : cfg.topP,
    frequencyPenalty: skipMeta ? null : cfg.frequencyPenalty,
    timeoutMs:
      cfg.model === "deepseek-reasoner"
        ? Math.max(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, 90_000)
        : opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  return { result: single, loggedAlready: false };
}

/**
 * Fire-and-forget log to AIUsageLog. Errors are swallowed — logging must
 * never block or fail the caller.
 */
function logUsage(opts: CallAIOptions, result: CallAIResult): void {
  const model =
    result.model ??
    (result.provider === "anthropic" ? ANTHROPIC_MODEL : DEEPSEEK_MODEL);
  // Route through the shared chokepoint so these rows ALSO get a frozen costIdr +
  // usdIdrRate (previously only Perplexity rows did), keeping the AI stats'
  // historical Rupiah consistent across providers. Fire-and-forget inside.
  recordAiUsage({
    userId: opts.userId ?? "system",
    userName: opts.userName ?? (opts.userId ? "user" : "system"),
    feature: opts.feature,
    provider: result.provider,
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.totalTokens,
    articleTitle: opts.articleTitle,
  });
}

async function executeProvider(
  provider: Provider,
  opts: CallAIOptions,
  apiKey: string,
  settings: SettingsDict,
): Promise<CallAIResult> {
  if (provider === "anthropic") {
    const result = await callAnthropic(opts, apiKey, getAnthropicConfig(settings));
    logUsage(opts, result);
    return result;
  }
  const { result, loggedAlready } = await callDeepSeek(
    opts,
    apiKey,
    getDeepSeekConfig(settings),
  );
  if (!loggedAlready) logUsage(opts, result);
  return result;
}

/**
 * Main entry point. Respects `ai_primary_provider` ("anthropic" | "deepseek",
 * default "anthropic") with automatic fallback to the secondary provider.
 * If `forceProvider` is set, skip fallback and call only that provider.
 */
export async function callAI(opts: CallAIOptions): Promise<CallAIResult> {
  const settings = await readSettingsMap(CONFIG_SETTING_KEYS);
  if (settings.enable_ai === "false" && opts.feature !== "test") {
    throw new Error("Fitur AI sedang dinonaktifkan di Pengaturan Sistem.");
  }

  // Forced provider path — no fallback.
  if (opts.forceProvider === "anthropic" || opts.forceProvider === "deepseek") {
    const key = await getApiKey(opts.forceProvider);
    if (!key) {
      throw new Error(
        `AI provider '${opts.forceProvider}' forced but no API key configured`,
      );
    }
    return executeProvider(opts.forceProvider, opts, key, settings);
  }

  const order: [Provider, Provider] =
    settings.ai_primary_provider === "deepseek"
      ? ["deepseek", "anthropic"]
      : ["anthropic", "deepseek"];

  const [firstKey, secondKey] = await Promise.all([
    getApiKey(order[0]),
    getApiKey(order[1]),
  ]);
  const keyMap: Record<Provider, string | null> = {
    [order[0]]: firstKey,
    [order[1]]: secondKey,
  } as Record<Provider, string | null>;

  const errors: string[] = [];

  for (let i = 0; i < order.length; i++) {
    const provider = order[i];
    const key = keyMap[provider];
    if (!key) {
      errors.push(`${provider}: no API key configured`);
      continue;
    }
    try {
      return await executeProvider(provider, opts, key, settings);
    } catch (err) {
      // Prompt-level 400 errors will fail the fallback too — fail fast.
      if (i === 0 && !isRetryable(err)) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}: ${msg}`);
    }
  }

  throw new Error(`AI providers exhausted: ${errors.join("; ")}`);
}
