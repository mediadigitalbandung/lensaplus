/**
 * Google Search Console (Webmasters) API wrapper.
 *
 * Reuses the same service-account JSON stored in
 * `SystemSetting.google_credentials_json` (service account must be granted
 * Owner on the Search Console property). Site URL is read from
 * `SystemSetting.gsc_site_url`, falling back to `NEXT_PUBLIC_APP_URL`.
 *
 * All failures resolve to a zero-valued fallback struct with `_error` set —
 * never throws.
 *
 * Docs: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 */

import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const CACHE_TTL_MS = 5 * 60 * 1000;

// ---------- Types ----------

export interface GSCStats {
  impressions: number;
  clicks: number;
  ctr: number; // 0..1
  avgPosition: number;
  topQueries: Array<{
    query: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
  dailyTrend: Array<{ date: string; impressions: number; clicks: number }>;
  _error?: string;
}

export interface GSCOptions {
  from: string;
  to: string;
  siteUrl?: string;
}

interface ServiceAccountCredentials {
  type?: string;
  client_email?: string;
  private_key?: string;
}

// ---------- Cache ----------

interface CacheEntry {
  data: GSCStats;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(opts: GSCOptions) {
  return `gsc:${opts.from}:${opts.to}:${opts.siteUrl ?? "default"}`;
}

function getCached(key: string): GSCStats | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: GSCStats) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------- Credentials & site URL ----------

async function getCredentials(): Promise<ServiceAccountCredentials | null> {
  let raw: string | null = null;
  try {
    const cred = await prisma.systemSetting.findUnique({
      where: { key: "google_credentials_json" },
    });
    if (cred?.value && cred.value.trim().length > 0) {
      raw = decryptSecret(cred.value.trim());
    }
  } catch {
    // ignore
  }
  if (!raw) {
    const envValue = process.env.GOOGLE_CREDENTIALS_JSON;
    if (envValue && envValue.trim().length > 0) raw = envValue.trim();
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccountCredentials;
    if (parsed.type !== "service_account") return null;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getSiteUrl(override?: string): Promise<string | null> {
  if (override && override.trim().length > 0) return override.trim();
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: "gsc_site_url" },
    });
    if (row?.value && row.value.trim().length > 0) return row.value.trim();
  } catch {
    // ignore
  }
  const envPub = process.env.NEXT_PUBLIC_APP_URL;
  if (envPub && envPub.trim().length > 0) return envPub.trim();
  return null;
}

// ---------- Fallback ----------

function emptyStats(error?: string): GSCStats {
  return {
    impressions: 0,
    clicks: 0,
    ctr: 0,
    avgPosition: 0,
    topQueries: [],
    topPages: [],
    dailyTrend: [],
    ...(error ? { _error: error } : {}),
  };
}

// ---------- Main ----------

export async function getGSCData(opts: GSCOptions): Promise<GSCStats> {
  const key = cacheKey(opts);
  const cached = getCached(key);
  if (cached) return cached;

  const credentials = await getCredentials();
  if (!credentials) {
    return emptyStats("Not configured: missing google_credentials_json");
  }

  const siteUrl = await getSiteUrl(opts.siteUrl);
  if (!siteUrl) {
    return emptyStats("Not configured: missing gsc_site_url");
  }

  try {
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [GSC_SCOPE],
    });
    const searchconsole = google.searchconsole({ version: "v1", auth });

    // Aggregated totals (no dimensions) — Search Console returns one row
    // with totals when you omit dimensions.
    const totalsP = searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: opts.from,
        endDate: opts.to,
        rowLimit: 1,
      },
    });

    const queriesP = searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: opts.from,
        endDate: opts.to,
        dimensions: ["query"],
        rowLimit: 10,
      },
    });

    const pagesP = searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: opts.from,
        endDate: opts.to,
        dimensions: ["page"],
        rowLimit: 10,
      },
    });

    const dailyP = searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: opts.from,
        endDate: opts.to,
        dimensions: ["date"],
        rowLimit: 90,
      },
    });

    const [totalsRes, queriesRes, pagesRes, dailyRes] = await Promise.all([
      totalsP,
      queriesP,
      pagesP,
      dailyP,
    ]);

    const totalsRow = totalsRes.data.rows?.[0];
    const impressions = Number(totalsRow?.impressions ?? 0);
    const clicks = Number(totalsRow?.clicks ?? 0);
    const ctr = Number(totalsRow?.ctr ?? 0);
    const avgPosition = Number(totalsRow?.position ?? 0);

    const topQueries = (queriesRes.data.rows ?? []).map((r) => ({
      query: r.keys?.[0] ?? "",
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      ctr: Number(r.ctr ?? 0),
      position: Number(r.position ?? 0),
    }));

    const topPages = (pagesRes.data.rows ?? []).map((r) => ({
      page: r.keys?.[0] ?? "",
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      ctr: Number(r.ctr ?? 0),
      position: Number(r.position ?? 0),
    }));

    const dailyTrend = (dailyRes.data.rows ?? []).map((r) => ({
      date: r.keys?.[0] ?? "",
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
    }));

    const result: GSCStats = {
      impressions,
      clicks,
      ctr,
      avgPosition,
      topQueries,
      topPages,
      dailyTrend,
    };
    setCached(key, result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return emptyStats(msg);
  }
}
