/**
 * Local / self-hosted AI provider (OpenAI-compatible chat completions).
 *
 * Lets Kartawarta use a private LLM server — e.g. an Ollama / LM Studio / vLLM /
 * llama.cpp box on the editor's Mac mini reachable over Tailscale — as an extra
 * article-drafting engine ALONGSIDE Perplexity. Self-hosted = no per-token cost.
 *
 * IMPORTANT: production runs on the VPS, so the VPS must be able to reach the
 * server URL (put the Tailscale IP, e.g. http://100.81.47.91:11434, and make
 * sure the VPS is on the same tailnet). No web search — good for writing/
 * rewriting/summarizing, NOT for grounded research (that stays Perplexity).
 *
 * Config (SystemSetting, Pengaturan → AI):
 *   localai_enabled   — "true" to activate
 *   localai_base_url  — e.g. http://100.81.47.91:11434  (/v1 optional)
 *   localai_model     — e.g. "hermes3", "llama3.1:8b", "qwen2.5"
 *   localai_api_key   — optional bearer token (encrypted at rest)
 *   localai_prefer    — "true" → try Local AI BEFORE Perplexity for drafting
 */

import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";
import { recordAiUsage } from "@/lib/ai-usage";

const TIMEOUT_MS = 120_000; // CPU inference can be slow

export interface LocalAiConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  prefer: boolean;
}

export async function getLocalAiConfig(): Promise<LocalAiConfig> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["localai_enabled", "localai_base_url", "localai_model", "localai_api_key", "localai_prefer"] } },
      select: { key: true, value: true },
    });
    const m = Object.fromEntries(rows.map((r) => [r.key, (r.value ?? "").trim()]));
    let apiKey: string | null = null;
    if (m.localai_api_key) {
      try { apiKey = decryptSecret(m.localai_api_key); } catch { apiKey = m.localai_api_key; }
    }
    return {
      enabled: m.localai_enabled === "true",
      baseUrl: m.localai_base_url || "",
      model: m.localai_model || "",
      apiKey: apiKey || null,
      prefer: m.localai_prefer === "true",
    };
  } catch {
    return { enabled: false, baseUrl: "", model: "", apiKey: null, prefer: false };
  }
}

/** Ready = enabled + a base URL + a model. */
export function isLocalAiReady(cfg: LocalAiConfig): boolean {
  return cfg.enabled && /^https?:\/\//i.test(cfg.baseUrl) && cfg.model.length > 0;
}

/** Normalize base URL → the OpenAI-compatible chat-completions endpoint. */
function chatEndpoint(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "").replace(/\/v1$/i, "");
  return `${base}/v1/chat/completions`;
}

export interface LocalAiOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  /** Attribution for the cost/usage log (provider "local", cost = 0). */
  usageMeta?: { userId: string; userName: string; feature: string; articleTitle?: string | null };
}

export interface LocalAiResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  model: string;
}

/**
 * Call the local OpenAI-compatible server. Throws a friendly Error on failure
 * so the caller can fall back to another engine.
 */
export async function callLocalAI(opts: LocalAiOptions): Promise<LocalAiResult> {
  const cfg = await getLocalAiConfig();
  if (!isLocalAiReady(cfg)) throw new Error("LOCALAI_NOT_CONFIGURED");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(chatEndpoint(cfg.baseUrl), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
        max_tokens: opts.maxTokens ?? 1600,
        temperature: opts.temperature ?? 0.4,
        stream: false,
      }),
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`Local AI HTTP ${res.status}: ${detail || "no body"}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("Local AI mengembalikan respons kosong.");

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;
    const model = data.model || cfg.model;

    if (opts.usageMeta) {
      recordAiUsage({
        ...opts.usageMeta,
        provider: "local",
        model,
        inputTokens,
        outputTokens,
        totalTokens,
      });
    }

    return { text, usage: { inputTokens, outputTokens, totalTokens }, model };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Local AI timeout — server tidak merespons (cek Mac mini/Tailscale).");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
