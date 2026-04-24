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
}

// ---------- Cache ----------

interface CacheEntry {
  data: CloudflareStats;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(opts: CloudflareOptions) {
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

// ---------- Credentials ----------

async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (row?.value && row.value.trim().length > 0) return row.value.trim();
  } catch {
    // ignore
  }
  return null;
}

async function getCredentials(): Promise<{
  token: string;
  zoneId: string;
} | null> {
  const token =
    (await getSetting("cloudflare_api_token")) ??
    process.env.CLOUDFLARE_API_TOKEN ??
    null;
  const zoneId =
    (await getSetting("cloudflare_zone_id")) ??
    process.env.CLOUDFLARE_ZONE_ID ??
    null;
  if (!token || !zoneId) return null;
  return { token: token.trim(), zoneId: zoneId.trim() };
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
          limit: 90
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

// ---------- Main ----------

export async function getCloudflareAnalytics(
  opts: CloudflareOptions,
): Promise<CloudflareStats> {
  const key = cacheKey(opts);
  const cached = getCached(key);
  if (cached) return cached;

  const creds = await getCredentials();
  if (!creds) {
    return emptyStats(
      "Not configured: missing cloudflare_api_token or cloudflare_zone_id",
    );
  }

  try {
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
          start: opts.from,
          end: opts.to,
        },
      }),
    });

    if (!res.ok) {
      return emptyStats(`Cloudflare API HTTP ${res.status}`);
    }

    const json = (await res.json()) as CfGraphqlResponse;
    if (json.errors && json.errors.length > 0) {
      return emptyStats(json.errors.map((e) => e.message).join("; "));
    }

    const groups =
      json.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];

    let requests = 0;
    let bandwidth = 0;
    let cachedRequests = 0;
    let threats = 0;

    const dailyTrend = groups.map((g) => {
      const s = g.sum;
      requests += s.requests;
      bandwidth += s.bytes;
      cachedRequests += s.cachedRequests;
      threats += s.threats;
      return {
        date: g.dimensions.date,
        requests: s.requests,
        bandwidth: s.bytes,
        cachedRequests: s.cachedRequests,
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
    const msg = err instanceof Error ? err.message : String(err);
    return emptyStats(msg);
  }
}
