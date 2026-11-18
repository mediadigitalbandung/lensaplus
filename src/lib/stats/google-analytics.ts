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
import { decryptSecret, isEncrypted } from "@/lib/crypto-secrets";

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

function withTimeout<T>(p: Promise<T>, ms = 15000, label = "TIMEOUT"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`GA_${label}`)), ms);
  });
  return Promise.race([p, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
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
  refresh?: boolean;
}

export interface ServiceAccountCredentials {
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

function cacheKey(opts: { from: string; to: string; propertyId?: string }) {
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
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (now > v.expiresAt) cache.delete(k);
  }
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, { data, expiresAt: now + CACHE_TTL_MS });
}

export function clearGA4Cache(): void {
  cache.clear();
}

/**
 * Normalizes the JSON response returned by `/api/stats/google-analytics`,
 * `/api/stats/google-search`, or `/api/stats/cloudflare`.
 * Supports both flat `{ success, data: <stats>, error?, _partialError? }`
 * and legacy nested `{ success: true, data: { data: <stats>, _partialError? } }`
 * so the UI never crashes on undefined properties.
 */
export function extractStatsPayload<T extends { _error?: string }>(
  resOk: boolean,
  status: number,
  json: unknown,
): { data: T | null; error: string | null } {
  if (!json || typeof json !== "object") {
    return {
      data: null,
      error: resOk ? "Respons server tidak valid" : `HTTP ${status}`,
    };
  }
  const obj = json as Record<string, unknown>;
  const rawData = obj.data as Record<string, unknown> | undefined;
  const unwrapped =
    rawData &&
    typeof rawData === "object" &&
    rawData.data &&
    typeof rawData.data === "object" &&
    !Array.isArray(rawData.data)
      ? (rawData.data as T)
      : ((rawData ?? null) as T | null);

  const errMsg =
    (typeof obj.error === "string" && obj.error.trim()) ||
    (typeof obj._partialError === "string" && obj._partialError.trim()) ||
    (rawData &&
      typeof rawData._partialError === "string" &&
      rawData._partialError.trim()) ||
    (unwrapped &&
      typeof unwrapped._error === "string" &&
      unwrapped._error.trim()) ||
    (!resOk
      ? `HTTP ${status}`
      : obj.success === false
        ? "Gagal memuat data statistik"
        : null);

  return { data: unwrapped, error: errMsg || null };
}

// ---------- Credentials & Property ID ----------

function isMaskedPlaceholder(val: string): boolean {
  const trimmed = val.trim();
  return (
    trimmed.startsWith("••••") ||
    trimmed.startsWith("····") ||
    trimmed === "(tidak berubah)"
  );
}

function stripWrappingQuotes(val: string): string {
  const t = val.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

export function parseServiceAccountCredentials(
  raw: string,
): ServiceAccountCredentials | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = stripWrappingQuotes(raw);
  if (!cleaned || isMaskedPlaceholder(cleaned)) return null;

  try {
    const parsed = JSON.parse(cleaned) as ServiceAccountCredentials;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.type !== "service_account") return null;
    if (
      typeof parsed.client_email !== "string" ||
      !parsed.client_email.trim() ||
      typeof parsed.private_key !== "string" ||
      !parsed.private_key.trim()
    ) {
      return null;
    }
    return {
      ...parsed,
      client_email: parsed.client_email.trim(),
      // Normalize literal escaped \n sequences into actual PEM newlines
      private_key: parsed.private_key.replace(/\\n/g, "\n").trim(),
    };
  } catch {
    return null;
  }
}

export function normalizeGA4PropertyId(raw: string | null | undefined): {
  propertyId: string | null;
  error?: string;
} {
  if (!raw || typeof raw !== "string") return { propertyId: null };
  let cleaned = raw.trim();
  if (!cleaned || isMaskedPlaceholder(cleaned)) return { propertyId: null };

  if (isEncrypted(cleaned)) {
    try {
      cleaned = decryptSecret(cleaned).trim();
    } catch {
      return {
        propertyId: null,
        error: "Invalid ga4_property_id: gagal mendekripsi nilai pengaturan",
      };
    }
  }

  cleaned = stripWrappingQuotes(cleaned)
    .replace(/^properties\//i, "")
    .trim();

  if (!cleaned) return { propertyId: null };

  if (/^G-[A-Z0-9]+$/i.test(cleaned)) {
    return {
      propertyId: null,
      error:
        "Invalid ga4_property_id: nilai dimulai dengan 'G-' (Measurement ID). Masukkan Property ID berupa angka (contoh: 123456789) dari GA4 → Admin → Property Settings.",
    };
  }

  if (!/^\d+$/.test(cleaned)) {
    return {
      propertyId: null,
      error:
        "Invalid ga4_property_id: GA4 Property ID harus berupa angka (contoh: 123456789).",
    };
  }

  return { propertyId: cleaned };
}

async function getCredentials(): Promise<{
  credentials: ServiceAccountCredentials | null;
  error?: string;
}> {
  let hadInvalid = false;

  try {
    const cred = await prisma.systemSetting.findUnique({
      where: { key: "google_credentials_json" },
    });
    if (cred?.value && cred.value.trim().length > 0) {
      const trimmed = cred.value.trim();
      if (!isMaskedPlaceholder(trimmed)) {
        try {
          const decrypted = decryptSecret(trimmed);
          const parsed = parseServiceAccountCredentials(decrypted);
          if (parsed) return { credentials: parsed };
          hadInvalid = true;
        } catch {
          hadInvalid = true;
        }
      }
    }
  } catch {
    // DB unavailable — fall through to env.
  }

  const envValue = process.env.GOOGLE_CREDENTIALS_JSON;
  if (envValue && envValue.trim().length > 0) {
    try {
      const decrypted = isEncrypted(envValue.trim())
        ? decryptSecret(envValue.trim())
        : envValue.trim();
      const parsed = parseServiceAccountCredentials(decrypted);
      if (parsed) return { credentials: parsed };
      hadInvalid = true;
    } catch {
      hadInvalid = true;
    }
  }

  if (hadInvalid) {
    return {
      credentials: null,
      error:
        "Invalid google_credentials_json: JSON Service Account tidak valid atau field client_email/private_key kosong",
    };
  }

  return {
    credentials: null,
    error: "Not configured: missing google_credentials_json",
  };
}

async function getPropertyId(override?: string): Promise<{
  propertyId: string | null;
  error?: string;
}> {
  if (override && override.trim().length > 0) {
    const res = normalizeGA4PropertyId(override);
    if (res.propertyId || res.error) return res;
  }

  let validationError: string | undefined;

  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: "ga4_property_id" },
    });
    if (row?.value && row.value.trim().length > 0) {
      const res = normalizeGA4PropertyId(row.value);
      if (res.propertyId) return res;
      if (res.error) validationError = res.error;
    }
  } catch {
    // ignore
  }

  const env = process.env.GA4_PROPERTY_ID;
  if (env && env.trim().length > 0) {
    const res = normalizeGA4PropertyId(env);
    if (res.propertyId) return res;
    if (res.error && !validationError) validationError = res.error;
  }

  return {
    propertyId: null,
    error: validationError ?? "Not configured: missing ga4_property_id",
  };
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
  const from = opts.from <= opts.to ? opts.from : opts.to;
  const to = opts.from <= opts.to ? opts.to : opts.from;

  const key = cacheKey({ from, to, propertyId: opts.propertyId });
  if (!opts.refresh) {
    const cached = getCached(key);
    if (cached) return cached;
  }

  const { credentials, error: credError } = await getCredentials();
  if (!credentials) {
    return emptyStats(credError ?? "Not configured: missing google_credentials_json");
  }

  const { propertyId, error: propError } = await getPropertyId(opts.propertyId);
  if (!propertyId) {
    return emptyStats(propError ?? "Not configured: missing ga4_property_id");
  }

  try {
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [GA4_SCOPE],
    });

    const analytics = google.analyticsdata({ version: "v1beta", auth });
    const property = `properties/${propertyId}`;

    // Totals + top pages + daily trend
    const totalsReportP = withTimeout(
      analytics.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: from, endDate: to }],
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
          dateRanges: [{ startDate: from, endDate: to }],
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
          dateRanges: [{ startDate: from, endDate: to }],
          dimensions: [{ name: "date" }],
          metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit: "366",
        },
      }),
    );

    const [totalsRes, topPagesRes, dailyRes] = await Promise.all([
      totalsReportP,
      topPagesReportP,
      dailyReportP,
    ]);

    const totalsRow = totalsRes.data.rows?.[0];
    const pageviews = Number(totalsRow?.metricValues?.[0]?.value ?? 0) || 0;
    const users = Number(totalsRow?.metricValues?.[1]?.value ?? 0) || 0;
    const sessions = Number(totalsRow?.metricValues?.[2]?.value ?? 0) || 0;
    const avgSessionDurationSec =
      Number(totalsRow?.metricValues?.[3]?.value ?? 0) || 0;

    const topPages = (topPagesRes.data.rows ?? []).map((r) => ({
      path: r.dimensionValues?.[0]?.value ?? "",
      pageviews: Number(r.metricValues?.[0]?.value ?? 0) || 0,
      users: Number(r.metricValues?.[1]?.value ?? 0) || 0,
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
        pageviews: Number(r.metricValues?.[0]?.value ?? 0) || 0,
        users: Number(r.metricValues?.[1]?.value ?? 0) || 0,
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
