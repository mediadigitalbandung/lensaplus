/**
 * Perplexity (Sonar) API client — web-grounded research with citations.
 *
 * Used to research a news topic in real time and draft a sourced article. Unlike
 * the Claude/DeepSeek path (`ai-client.ts`), Perplexity searches the live web and
 * returns the sources it used, so drafts cite real, recent articles.
 *
 * OpenAI-compatible: POST https://api.perplexity.ai/chat/completions.
 * Key from SystemSetting `perplexity_api_key` (encrypted) with env fallback.
 */

import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
// Economical by default: `sonar` output tokens are ~15× cheaper than sonar-pro
// and it's plenty for news drafting. Editors can upgrade to sonar-pro per
// SystemSetting `perplexity_model` (Pengaturan → AI) when they want deeper research.
const DEFAULT_MODEL = process.env.PERPLEXITY_MODEL || "sonar";
const TIMEOUT_MS = 90_000; // research can be slow

// Sonar models, cheapest → most expensive. `sonar` is the economical default
// for drafting (output tokens ~15× cheaper than sonar-pro); the pricier ones
// add deeper reasoning/research the newsroom rarely needs.
export const PERPLEXITY_MODELS = [
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
  "sonar-deep-research",
] as const;

const VALID_CONTEXT = ["low", "medium", "high"] as const;

/**
 * Cost-control knobs, all editor-settable via SystemSetting (Pengaturan → AI):
 *   perplexity_model           — which Sonar model (default sonar-pro)
 *   perplexity_max_tokens      — hard cap on output tokens (the main cost lever);
 *                                empty/0 = no extra cap (use each caller's value)
 *   perplexity_search_context  — low | medium | high (search retrieval cost)
 * Read in one round-trip so callPerplexity adds just a single extra query.
 */
async function getPerplexityConfig(): Promise<{
  model: string;
  maxTokensCap: number | null;
  contextSize: "low" | "medium" | "high" | null;
}> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["perplexity_model", "perplexity_max_tokens", "perplexity_search_context"] } },
      select: { key: true, value: true },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, (r.value ?? "").trim()]));
    const model = (PERPLEXITY_MODELS as readonly string[]).includes(map.perplexity_model)
      ? map.perplexity_model
      : DEFAULT_MODEL;
    const cap = parseInt(map.perplexity_max_tokens || "0", 10);
    const maxTokensCap = Number.isFinite(cap) && cap > 0 ? cap : null;
    const contextSize = (VALID_CONTEXT as readonly string[]).includes(map.perplexity_search_context)
      ? (map.perplexity_search_context as "low" | "medium" | "high")
      : null;
    return { model, maxTokensCap, contextSize };
  } catch {
    return { model: DEFAULT_MODEL, maxTokensCap: null, contextSize: null };
  }
}

export interface PerplexitySource {
  title: string | null;
  url: string;
  date: string | null;
}

export interface PerplexityImage {
  imageUrl: string;
  originUrl: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
}

export interface PerplexityResult {
  text: string;
  sources: PerplexitySource[];
  related: string[];
  images: PerplexityImage[];
}

export interface PerplexityOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  /** "hour" | "day" | "week" | "month" | "year" — bias search toward recent news. */
  recency?: "hour" | "day" | "week" | "month" | "year";
  /** Allowlist of domains (e.g. Indonesian outlets). */
  domains?: string[];
  /** Retrieval depth: more context = better sourcing but higher cost. */
  contextSize?: "low" | "medium" | "high";
  /** When true, ask Perplexity to also return related images from the web. */
  includeImages?: boolean;
}

async function getApiKey(): Promise<string | null> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: "perplexity_api_key" } });
    if (row?.value && row.value.trim().length > 0) {
      try {
        return decryptSecret(row.value.trim());
      } catch {
        return row.value.trim();
      }
    }
  } catch {
    /* DB unreachable — fall through to env */
  }
  const env = process.env.PERPLEXITY_API_KEY;
  return env && env.trim().length > 0 ? env.trim() : null;
}

export async function isPerplexityConfigured(): Promise<boolean> {
  return Boolean(await getApiKey());
}

/**
 * Optional editor-defined writing instructions / author persona for the
 * Perplexity drafter (SystemSetting `perplexity_instructions`). Appended to the
 * system prompt so drafts match a desired voice/style. Empty when unset.
 */
export async function getPerplexityInstructions(): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: "perplexity_instructions" } });
    return (row?.value ?? "").trim();
  } catch {
    return "";
  }
}

interface PplxResponse {
  choices?: { message?: { content?: string } }[];
  citations?: string[];
  search_results?: { title?: string; url?: string; date?: string }[];
  related_questions?: string[];
  images?: { image_url?: string; origin_url?: string; title?: string; width?: number; height?: number }[];
}

/**
 * Run a web-grounded Perplexity query. Throws a user-friendly Error on auth/credit/
 * rate-limit/other failures so the route can surface a clear message.
 */
export async function callPerplexity(opts: PerplexityOptions): Promise<PerplexityResult> {
  const key = await getApiKey();
  if (!key) {
    throw new Error("PERPLEXITY_NOT_CONFIGURED");
  }

  const cfg = await getPerplexityConfig();
  // Output tokens are the dominant cost — honour an editor-set hard cap.
  const requestedMax = opts.maxTokens ?? 1800;
  const maxTokens = cfg.maxTokensCap ? Math.min(requestedMax, cfg.maxTokensCap) : requestedMax;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userPrompt },
      ],
      temperature: opts.temperature ?? 0.2,
      max_tokens: maxTokens,
      search_mode: "web",
      return_related_questions: true,
      // The editor's cost setting wins (so it actually saves money even though
      // callers default to "high"); else the caller value; else "high".
      web_search_options: { search_context_size: cfg.contextSize ?? opts.contextSize ?? "high" },
    };
    if (opts.recency) body.search_recency_filter = opts.recency;
    if (opts.domains && opts.domains.length > 0) body.search_domain_filter = opts.domains;
    if (opts.includeImages) body.return_images = true;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          /credit|billing/i.test(detail)
            ? "Kredit Perplexity habis atau billing belum aktif. Isi kredit di perplexity.ai."
            : "API key Perplexity tidak valid (401/403). Periksa kembali di Pengaturan.",
        );
      }
      if (res.status === 429) {
        throw new Error("Batas rate Perplexity tercapai (429). Coba lagi beberapa saat.");
      }
      if (res.status === 400 && /model/i.test(detail)) {
        throw new Error(`Model Perplexity tidak valid (${cfg.model}). ${detail}`);
      }
      throw new Error(`Perplexity error ${res.status}: ${detail}`);
    }

    const data = (await res.json()) as PplxResponse;
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    // Prefer the current `search_results`; fall back to the legacy `citations`.
    const sources: PerplexitySource[] =
      (data.search_results || [])
        .filter((s) => s?.url)
        .map((s) => ({ title: s.title ?? null, url: s.url as string, date: s.date ?? null }));
    if (sources.length === 0 && Array.isArray(data.citations)) {
      for (const url of data.citations) {
        if (url) sources.push({ title: null, url, date: null });
      }
    }

    const images: PerplexityImage[] = (data.images || [])
      .filter((im) => im?.image_url)
      .map((im) => ({
        imageUrl: im.image_url as string,
        originUrl: im.origin_url ?? null,
        title: im.title ?? null,
        width: typeof im.width === "number" ? im.width : null,
        height: typeof im.height === "number" ? im.height : null,
      }));

    return { text, sources, related: data.related_questions ?? [], images };
  } finally {
    clearTimeout(timer);
  }
}
