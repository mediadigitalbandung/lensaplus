/**
 * Google Analytics 4 Data API wrapper.
 *
 * Reads service-account credentials from `SystemSetting.google_credentials_json`
 * (shared with the Indexing API client, see `src/lib/seo/google-indexing.ts`).
 * Property ID comes from `SystemSetting.ga4_property_id` or the `propertyId`
 * option override.
 *
 * All failures (missing credentials, bad property id, API errors) resolve
 * to a zero-valued fallback struct with `_error` set — never throws. This
 * keeps the dashboard UI operational before credentials are configured.
 *
 * Docs: https://developers.google.com/analytics/devguides/reporting/data/v1
 */

import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const CACHE_TTL_MS = 5 * 60 * 1000;

function withTimeout<T>(p: Promise<T>, ms = 15000, label = "TIMEOUT"): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`GA_${label}`)), ms),
    ),
  ]);
}

// ---------- Types ----------

export interface GA4Stats {
  pageviews: number;
  users: number;
  sessions: number;
  avgSessionDurationSec: number;
  topPages: Array<{ path: string; pageviews: number; users: number }>;
  dailyTrend: Array<{ date: string; pageviews: number; users: number }>;
  _error?: string;
}

export interface GA4Options {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  propertyId?: string;
}

interface ServiceAccountCredentials {
  type?: string;
  client_email?: string;
  private_key?: string;
}

// ---------- Cache ----------

interface CacheEntry {
  data: GA4Stats;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(opts: GA4Options) {
  return `ga4:${opts.from}:${opts.to}:${opts.propertyId ?? "default"}`;
}

function getCached(key: string): GA4Stats | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: GA4Stats) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------- Credentials ----------

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
    // DB unavailable — fall through to env.
  }

  if (!raw) {
    const envValue = process.env.GOOGLE_CREDENTIALS_JSON;
    if (envValue && envValue.trim().length > 0) {
      raw = envValue.trim();
    }
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

async function getPropertyId(override?: string): Promise<string | null> {
  if (override && override.trim().length > 0) return override.trim();
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: "ga4_property_id" },
    });
    if (row?.value && row.value.trim().length > 0) return row.value.trim();
  } catch {
    // ignore
  }
  const env = process.env.GA4_PROPERTY_ID;
  if (env && env.trim().length > 0) return env.trim();
  return null;
}

// ---------- Fallback ----------

function emptyStats(error?: string): GA4Stats {
  return {
    pageviews: 0,
    users: 0,
    sessions: 0,
    avgSessionDurationSec: 0,
    topPages: [],
    dailyTrend: [],
    ...(error ? { _error: error } : {}),
  };
}

// ---------- Main ----------

export async function getGA4Data(opts: GA4Options): Promise<GA4Stats> {
  const key = cacheKey(opts);
  const cached = getCached(key);
  if (cached) return cached;

  const credentials = await getCredentials();
  if (!credentials) {
    return emptyStats("Not configured: missing google_credentials_json");
  }

  const propertyId = await getPropertyId(opts.propertyId);
  if (!propertyId) {
    return emptyStats("Not configured: missing ga4_property_id");
  }

  try {
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [GA4_SCOPE],
    });

    const analytics = google.analyticsdata({ version: "v1beta", auth });
    const property = `properties/${propertyId}`;

    // Totals + top pages in one report
    const totalsReportP = withTimeout(
      analytics.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: opts.from, endDate: opts.to }],
          metrics: [
            { name: "screenPageViews" },
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "averageSessionDuration" },
          ],
        },
      }),
    );

    const topPagesReportP = withTimeout(
      analytics.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: opts.from, endDate: opts.to }],
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
          orderBys: [
            { metric: { metricName: "screenPageViews" }, desc: true },
          ],
          limit: "10",
        },
      }),
    );

    const dailyReportP = withTimeout(
      analytics.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: opts.from, endDate: opts.to }],
          dimensions: [{ name: "date" }],
          metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit: "90",
        },
      }),
    );

    const [totalsRes, topPagesRes, dailyRes] = await Promise.all([
      totalsReportP,
      topPagesReportP,
      dailyReportP,
    ]);

    const totalsRow = totalsRes.data.rows?.[0];
    const pageviews = Number(totalsRow?.metricValues?.[0]?.value ?? 0);
    const users = Number(totalsRow?.metricValues?.[1]?.value ?? 0);
    const sessions = Number(totalsRow?.metricValues?.[2]?.value ?? 0);
    const avgSessionDurationSec = Number(
      totalsRow?.metricValues?.[3]?.value ?? 0,
    );

    const topPages = (topPagesRes.data.rows ?? []).map((r) => ({
      path: r.dimensionValues?.[0]?.value ?? "",
      pageviews: Number(r.metricValues?.[0]?.value ?? 0),
      users: Number(r.metricValues?.[1]?.value ?? 0),
    }));

    const dailyTrend = (dailyRes.data.rows ?? []).map((r) => {
      // GA4 returns date as "YYYYMMDD" — convert to "YYYY-MM-DD"
      const raw = r.dimensionValues?.[0]?.value ?? "";
      const date =
        raw.length === 8
          ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
          : raw;
      return {
        date,
        pageviews: Number(r.metricValues?.[0]?.value ?? 0),
        users: Number(r.metricValues?.[1]?.value ?? 0),
      };
    });

    const result: GA4Stats = {
      pageviews,
      users,
      sessions,
      avgSessionDurationSec,
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
