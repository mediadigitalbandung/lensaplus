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
import { recordAiUsage } from "@/lib/ai-usage";

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
 *   perplexity_model           — the DRAFT (writing) Sonar model (default sonar)
 *   perplexity_max_tokens      — hard cap on output tokens (the main cost lever);
 *                                empty/0 = no extra cap (use each caller's value)
 *   perplexity_search_context  — low | medium | high (search retrieval cost)
 *   perplexity_combo_enabled   — "true" → 2-stage Combo mode (research with a
 *                                stronger model, write with the cheap draft model)
 *   perplexity_research_model  — the RESEARCH model used in Combo (default sonar-pro)
 * Read in one round-trip so callPerplexity adds just a single extra query.
 */
async function getPerplexityConfig(): Promise<{
  model: string;
  researchModel: string;
  comboEnabled: boolean;
  maxTokensCap: number | null;
  contextSize: "low" | "medium" | "high" | null;
}> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            "perplexity_model",
            "perplexity_max_tokens",
            "perplexity_search_context",
            "perplexity_combo_enabled",
            "perplexity_research_model",
          ],
        },
      },
      select: { key: true, value: true },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, (r.value ?? "").trim()]));
    const model = (PERPLEXITY_MODELS as readonly string[]).includes(map.perplexity_model)
      ? map.perplexity_model
      : DEFAULT_MODEL;
    const researchModel = (PERPLEXITY_MODELS as readonly string[]).includes(map.perplexity_research_model)
      ? map.perplexity_research_model
      : "sonar-pro";
    const comboEnabled = map.perplexity_combo_enabled === "true";
    const cap = parseInt(map.perplexity_max_tokens || "0", 10);
    const maxTokensCap = Number.isFinite(cap) && cap > 0 ? cap : null;
    const contextSize = (VALID_CONTEXT as readonly string[]).includes(map.perplexity_search_context)
      ? (map.perplexity_search_context as "low" | "medium" | "high")
      : null;
    return { model, researchModel, comboEnabled, maxTokensCap, contextSize };
  } catch {
    return { model: DEFAULT_MODEL, researchModel: "sonar-pro", comboEnabled: false, maxTokensCap: null, contextSize: null };
  }
}

// Concise web-research brief used as stage 1 of Combo mode. Output stays SHORT
// (raw facts, not a full article) so the pricier research model costs little.
const RESEARCH_SYSTEM =
  "Anda periset berita untuk redaksi Kartawarta. Riset topik dari sumber berita Indonesia " +
  "yang kredibel dan TERBARU, lalu rangkum SECARA RINGKAS dalam poin-poin: fakta kunci, " +
  "kronologi (5W+1H), angka/data penting, dan kutipan penting beserta atribusinya. HANYA " +
  "tulis yang didukung sumber — jangan mengarang. Padat, tanpa basa-basi, dan JANGAN menulis " +
  "artikel utuh; cukup bahan mentah yang nanti ditulis ulang oleh penulis lain.";

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

/** One Perplexity API call's usage — Combo mode produces TWO of these so each
 *  is priced at ITS OWN model (a summed "sonar-pro+sonar" row would misprice). */
export interface PerplexityStage {
  model: string;
  searchContext: "low" | "medium" | "high";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface PerplexityResult {
  text: string;
  sources: PerplexitySource[];
  related: string[];
  images: PerplexityImage[];
  /** Token usage + the model/context used — for cost telemetry. */
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  model: string;
  searchContext: "low" | "medium" | "high";
  /** Per-API-call breakdown (1 normally, 2 in Combo mode) for accurate pricing. */
  stages: PerplexityStage[];
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
  /** When set, callPerplexity records cost telemetry (one AIUsageLog row PER
   *  stage, each at its own model) so callers don't have to. */
  usageMeta?: { userId?: string; userName?: string; feature: string; articleTitle?: string };
  /** Opt INTO Combo mode (2-stage research→write). Only FULL-DRAFT callers set
   *  this; short field generations / research briefs stay single-call even when
   *  the editor enabled Combo globally, so they don't pay for a 2nd API call. */
  allowCombo?: boolean;
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
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/** Low-level single Perplexity call with an EXPLICIT model + search depth. */
async function runPerplexity(p: {
  key: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  searchContext: "low" | "medium" | "high";
  temperature: number;
  recency?: "hour" | "day" | "week" | "month" | "year";
  domains?: string[];
  includeImages?: boolean;
}): Promise<Omit<PerplexityResult, "stages">> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body: Record<string, unknown> = {
      model: p.model,
      messages: [
        { role: "system", content: p.systemPrompt },
        { role: "user", content: p.userPrompt },
      ],
      temperature: p.temperature,
      max_tokens: p.maxTokens,
      search_mode: "web",
      return_related_questions: true,
      web_search_options: { search_context_size: p.searchContext },
    };
    if (p.recency) body.search_recency_filter = p.recency;
    if (p.domains && p.domains.length > 0) body.search_domain_filter = p.domains;
    if (p.includeImages) body.return_images = true;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
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
        throw new Error(`Model Perplexity tidak valid (${p.model}). ${detail}`);
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

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;

    return {
      text,
      sources,
      related: data.related_questions ?? [],
      images,
      usage: { inputTokens, outputTokens, totalTokens },
      model: p.model,
      searchContext: p.searchContext,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a web-grounded Perplexity query. Throws a user-friendly Error on auth/credit/
 * rate-limit/other failures so the route can surface a clear message.
 *
 * Combo mode (perplexity_combo_enabled): does it in TWO stages with TWO models —
 * a short research pass on the stronger model (good sourcing, few output tokens)
 * then the long write on the cheap draft model (low extra search). Transparent to
 * every caller; the returned `model` is "research+draft" and `usage` is summed.
 */
function stageOf(r: Omit<PerplexityResult, "stages">): PerplexityStage {
  return {
    model: r.model,
    searchContext: r.searchContext,
    inputTokens: r.usage.inputTokens,
    outputTokens: r.usage.outputTokens,
    totalTokens: r.usage.totalTokens,
  };
}

// Record one AIUsageLog row PER stage (each at its OWN model + search depth) so
// Combo cost is accurate, instead of being squashed into one mispriced
// "sonar-pro+sonar" row. Fire-and-forget inside recordAiUsage.
function recordStages(stages: PerplexityStage[], meta?: PerplexityOptions["usageMeta"]): void {
  if (!meta) return;
  for (const s of stages) {
    recordAiUsage({
      provider: "perplexity",
      model: s.model,
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      totalTokens: s.totalTokens,
      searchContext: s.searchContext,
      feature: meta.feature,
      userId: meta.userId ?? "system",
      userName: meta.userName ?? "system",
      articleTitle: meta.articleTitle,
    });
  }
}

export async function callPerplexity(opts: PerplexityOptions): Promise<PerplexityResult> {
  const key = await getApiKey();
  if (!key) {
    throw new Error("PERPLEXITY_NOT_CONFIGURED");
  }

  const cfg = await getPerplexityConfig();
  // Output tokens are the dominant cost — honour an editor-set hard cap.
  const requestedMax = opts.maxTokens ?? 1800;
  const draftMaxTokens = cfg.maxTokensCap ? Math.min(requestedMax, cfg.maxTokensCap) : requestedMax;
  // The editor's cost setting wins; else the caller value; else "high".
  const searchContext: "low" | "medium" | "high" = cfg.contextSize ?? opts.contextSize ?? "high";

  // ── Single-model path (default; also when the caller didn't opt into Combo,
  // or research==draft model) ──
  if (!cfg.comboEnabled || !opts.allowCombo || cfg.researchModel === cfg.model) {
    const r = await runPerplexity({
      key,
      model: cfg.model,
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.userPrompt,
      maxTokens: draftMaxTokens,
      searchContext,
      temperature: opts.temperature ?? 0.2,
      recency: opts.recency,
      domains: opts.domains,
      includeImages: opts.includeImages,
    });
    const stages = [stageOf(r)];
    recordStages(stages, opts.usageMeta);
    return { ...r, stages };
  }

  // ── Combo: stronger model researches (short → cheap), cheap model writes ──
  const research = await runPerplexity({
    key,
    model: cfg.researchModel,
    systemPrompt: RESEARCH_SYSTEM,
    userPrompt: opts.userPrompt,
    maxTokens: Math.min(900, draftMaxTokens),
    searchContext, // good retrieval where it matters
    temperature: 0.2,
    recency: opts.recency,
    domains: opts.domains,
    includeImages: false,
  });

  const draft = await runPerplexity({
    key,
    model: cfg.model,
    systemPrompt: opts.systemPrompt,
    userPrompt: `${opts.userPrompt}\n\n=== HASIL RISET (gunakan sebagai basis fakta; jangan menambah fakta di luar ini) ===\n${research.text}`,
    maxTokens: draftMaxTokens,
    searchContext: "low", // facts already gathered → minimise extra search cost
    temperature: opts.temperature ?? 0.3,
    domains: opts.domains,
    includeImages: opts.includeImages,
  });

  // Merge sources (research first, deduped by URL), sum token usage.
  const seen = new Set<string>();
  const mergedSources: PerplexitySource[] = [];
  for (const s of [...research.sources, ...draft.sources]) {
    if (s.url && !seen.has(s.url)) {
      seen.add(s.url);
      mergedSources.push(s);
    }
  }

  const stages = [stageOf(research), stageOf(draft)];
  recordStages(stages, opts.usageMeta);

  return {
    text: draft.text,
    sources: mergedSources,
    related: draft.related,
    images: draft.images,
    usage: {
      inputTokens: research.usage.inputTokens + draft.usage.inputTokens,
      outputTokens: research.usage.outputTokens + draft.usage.outputTokens,
      totalTokens: research.usage.totalTokens + draft.usage.totalTokens,
    },
    model: `${cfg.researchModel}+${cfg.model}`,
    searchContext: draft.searchContext,
    stages,
  };
}
