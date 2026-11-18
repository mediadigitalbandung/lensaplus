/**
 * Cloudflare GraphQL Analytics API wrapper.
 *
 * Queries `httpRequests1dGroups` for the configured zone to get traffic,
 * cache, and threat metrics. Credentials are read from SystemSetting:
 *   - `cloudflare_api_token`  (shared with Phase 6 cache-purge)
 *   - `cloudflare_zone_id`    (shared with Phase 6 cache-purge)
 *
 * Returns a zero-valued fallback with `_error` if credentials are missing
 * or the API call fails — never throws.
 *
 * Docs: https://developers.cloudflare.com/analytics/graphql-api/
 */

import { prisma } from "@/lib/prisma";
import { decryptSecret, isEncrypted, isSensitiveKey } from "@/lib/crypto-secrets";

const CF_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const CACHE_TTL_MS = 5 * 60 * 1000;

// ---------- Types ----------

export interface CloudflareStats {
  requests: number;
  bandwidth: number; // bytes
  cachedRequests: number;
  cacheHitRate: number; // 0..1
  threats: number;
  dailyTrend: Array<{
    date: string; // YYYY-MM-DD
    requests: number;
    bandwidth: number;
    cachedRequests: number;
  }>;
  _error?: string;
}

export interface CloudflareOptions {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  refresh?: boolean;
}

// ---------- Cache ----------

interface CacheEntry {
  data: CloudflareStats;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(opts: { from: string; to: string }) {
  return `cf:${opts.from}:${opts.to}`;
}

function getCached(key: string): CloudflareStats | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: CloudflareStats) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearCloudflareCache(): void {
  cache.clear();
}

// ---------- Credentials ----------

function isMaskedPlaceholder(val: string): boolean {
  const trimmed = val.trim();
  return (
    trimmed.startsWith("••••") ||
    trimmed.startsWith("····") ||
    trimmed === "(tidak berubah)"
  );
}

function cleanSecretValue(val: string): string {
  return val
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (row?.value && row.value.trim().length > 0) {
      const raw = row.value.trim();
      if (isMaskedPlaceholder(raw)) return null;
      const decrypted =
        isSensitiveKey(key) || isEncrypted(raw) ? decryptSecret(raw) : raw;
      const cleaned = cleanSecretValue(decrypted);
      return cleaned.length > 0 && !isMaskedPlaceholder(cleaned) ? cleaned : null;
    }
  } catch {
    // ignore decryption or DB error and fall through to env
  }
  return null;
}

async function getCredentials(): Promise<{
  token: string;
  zoneId: string;
} | null> {
  const dbToken = await getSetting("cloudflare_api_token");
  const envToken = process.env.CLOUDFLARE_API_TOKEN
    ? cleanSecretValue(process.env.CLOUDFLARE_API_TOKEN)
    : null;
  const token = dbToken || envToken || null;

  const dbZone = await getSetting("cloudflare_zone_id");
  const envZone = process.env.CLOUDFLARE_ZONE_ID
    ? cleanSecretValue(process.env.CLOUDFLARE_ZONE_ID)
    : null;
  const zoneId = dbZone || envZone || null;

  if (!token || !zoneId) return null;
  return { token, zoneId };
}

// ---------- Fallback ----------

function emptyStats(error?: string): CloudflareStats {
  return {
    requests: 0,
    bandwidth: 0,
    cachedRequests: 0,
    cacheHitRate: 0,
    threats: 0,
    dailyTrend: [],
    ...(error ? { _error: error } : {}),
  };
}

// ---------- GraphQL ----------

interface CfGraphqlResponse {
  data?: {
    viewer?: {
      zones?: Array<{
        httpRequests1dGroups?: Array<{
          dimensions: { date: string };
          sum: {
            requests: number;
            bytes: number;
            cachedBytes: number;
            cachedRequests: number;
            threats: number;
          };
        }>;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

const QUERY = `
  query ($zoneTag: string!, $start: Date!, $end: Date!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        httpRequests1dGroups(
          limit: 366
          filter: { date_geq: $start, date_leq: $end }
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          sum {
            requests
            bytes
            cachedBytes
            cachedRequests
            threats
          }
        }
      }
    }
  }
`;

function clampStartDate(start: string, end: string, maxDays: number): string {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (isNaN(startMs) || isNaN(endMs)) return start;
  const minStartMs = endMs - maxDays * 24 * 60 * 60 * 1000;
  if (startMs < minStartMs) {
    return new Date(minStartMs).toISOString().slice(0, 10);
  }
  return start;
}

function isRangeLimitError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes("range") ||
    lower.includes("time") ||
    lower.includes("exceed") ||
    lower.includes("retention") ||
    lower.includes("older than") ||
    lower.includes("not entitled") ||
    lower.includes("limit")
  );
}

async function queryCloudflareGraphql(
  creds: { token: string; zoneId: string },
  start: string,
  end: string,
  signal: AbortSignal,
): Promise<{ ok: boolean; status: number; json: CfGraphqlResponse | null }> {
  const res = await fetch(CF_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        zoneTag: creds.zoneId,
        start,
        end,
      },
    }),
    signal,
  });

  const json = (await res.json().catch(() => null)) as CfGraphqlResponse | null;
  return { ok: res.ok, status: res.status, json };
}

// ---------- Main ----------

export async function getCloudflareAnalytics(
  opts: CloudflareOptions,
): Promise<CloudflareStats> {
  const from = opts.from <= opts.to ? opts.from : opts.to;
  const to = opts.from <= opts.to ? opts.to : opts.from;

  const key = cacheKey({ from, to });
  if (!opts.refresh) {
    const cached = getCached(key);
    if (cached) return cached;
  }

  const creds = await getCredentials();
  if (!creds) {
    return emptyStats(
      "Not configured: missing cloudflare_api_token or cloudflare_zone_id",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const initial = await queryCloudflareGraphql(
      creds,
      from,
      to,
      controller.signal,
    );
    const { ok, status } = initial;
    let { json } = initial;

    if (!ok) {
      const detail = json?.errors?.map((e) => e.message).join("; ");
      return emptyStats(
        detail
          ? `Cloudflare API HTTP ${status}: ${detail}`
          : `Cloudflare API HTTP ${status}`,
      );
    }

    // Cloudflare Free plan restricts httpRequests1dGroups to a max 30-day window
    // (inclusive of start & end, so 30 days ago -> today = 31 days can be rejected).
    // Automatically retry with a clamped 28-day window if a range error occurs.
    if (json?.errors && json.errors.length > 0) {
      const combinedErr = json.errors.map((e) => e.message).join("; ");
      const clampedStart = clampStartDate(from, to, 28);
      if (clampedStart !== from && isRangeLimitError(combinedErr)) {
        const retry = await queryCloudflareGraphql(
          creds,
          clampedStart,
          to,
          controller.signal,
        );
        if (retry.ok && retry.json && (!retry.json.errors || retry.json.errors.length === 0)) {
          json = retry.json;
        } else {
          return emptyStats(combinedErr);
        }
      } else {
        return emptyStats(combinedErr);
      }
    }

    const zones = json?.data?.viewer?.zones;
    if (!zones || zones.length === 0) {
      return emptyStats(
        "Cloudflare Zone tidak ditemukan atau API Token belum memiliki izin Zone.Analytics:Read",
      );
    }

    const groups = zones[0]?.httpRequests1dGroups ?? [];

    let requests = 0;
    let bandwidth = 0;
    let cachedRequests = 0;
    let threats = 0;

    const dailyTrend = groups.map((g) => {
      const s = g.sum;
      const reqs = Number(s?.requests ?? 0) || 0;
      const bytes = Number(s?.bytes ?? 0) || 0;
      const cached = Number(s?.cachedRequests ?? 0) || 0;
      const thr = Number(s?.threats ?? 0) || 0;

      requests += reqs;
      bandwidth += bytes;
      cachedRequests += cached;
      threats += thr;
      return {
        date: g.dimensions?.date ?? "",
        requests: reqs,
        bandwidth: bytes,
        cachedRequests: cached,
      };
    });

    const cacheHitRate = requests > 0 ? cachedRequests / requests : 0;

    const result: CloudflareStats = {
      requests,
      bandwidth,
      cachedRequests,
      cacheHitRate,
      threats,
      dailyTrend,
    };
    setCached(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[cloudflare] GraphQL Analytics timeout (15s)");
      return emptyStats("TIMEOUT");
    }
    const msg = err instanceof Error ? err.message : String(err);
    return emptyStats(msg);
  } finally {
    clearTimeout(timeout);
  }
}
