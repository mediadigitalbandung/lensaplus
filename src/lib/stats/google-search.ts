/**
 * Google Search Console (Webmasters) API wrapper.
 *
 * Reuses the same service-account JSON stored in
 * `SystemSetting.google_credentials_json` (service account must be granted
 * Owner/Full permission on the Search Console property). Site URL is read from
 * `SystemSetting.gsc_site_url`, falling back to `GSC_SITE_URL`,
 * `SystemSetting.website_url`, or `NEXT_PUBLIC_APP_URL`.
 *
 * All failures resolve to a zero-valued fallback struct with `_error` set —
 * never throws.
 *
 * Docs: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 */

import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decryptSecret, isEncrypted } from "@/lib/crypto-secrets";
import {
  parseServiceAccountCredentials,
  type ServiceAccountCredentials,
} from "./google-analytics";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const CACHE_TTL_MS = 5 * 60 * 1000;

function withTimeout<T>(p: Promise<T>, ms = 15000, label = "GSC_TIMEOUT"): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`GA_${label}`)), ms),
    ),
  ]);
}

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
  refresh?: boolean;
}

// ---------- Cache ----------

interface CacheEntry {
  data: GSCStats;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(opts: { from: string; to: string; siteUrl?: string }) {
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

export function clearGSCCache(): void {
  cache.clear();
}

// ---------- Credentials & site URL ----------

function isMaskedPlaceholder(val: string): boolean {
  const trimmed = val.trim();
  return (
    trimmed.startsWith("••••") ||
    trimmed.startsWith("····") ||
    trimmed === "(tidak berubah)"
  );
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
          const raw = decryptSecret(trimmed);
          const parsed = parseServiceAccountCredentials(raw);
          if (parsed) return { credentials: parsed };
          hadInvalid = true;
        } catch {
          hadInvalid = true;
        }
      }
    }
  } catch {
    // ignore
  }

  const envValue = process.env.GOOGLE_CREDENTIALS_JSON;
  if (envValue && envValue.trim().length > 0) {
    try {
      const raw = isEncrypted(envValue.trim())
        ? decryptSecret(envValue.trim())
        : envValue.trim();
      const parsed = parseServiceAccountCredentials(raw);
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

/**
 * Normalizes a raw GSC site URL into an ordered list of candidate siteUrl
 * identifiers accepted by Google Search Console:
 * - Domain properties: `sc-domain:example.com`
 * - URL-prefix properties: `https://example.com/` (always with trailing slash for root origin)
 */
export function buildGscCandidateSiteUrls(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  let cleaned = raw.trim();
  if (!cleaned || isMaskedPlaceholder(cleaned)) return [];

  if (isEncrypted(cleaned)) {
    try {
      cleaned = decryptSecret(cleaned).trim();
    } catch {
      return [];
    }
  }

  cleaned = cleaned.replace(/^['"]|['"]$/g, "").trim();
  if (!cleaned) return [];

  const candidates: string[] = [];
  const pushUnique = (u: string) => {
    if (u && !candidates.includes(u)) candidates.push(u);
  };

  if (/^sc-domain:/i.test(cleaned)) {
    const host = cleaned
      .replace(/^sc-domain:/i, "")
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .trim()
      .toLowerCase();
    if (!host) return [];
    const bare = host.replace(/^www\./, "");
    pushUnique(`sc-domain:${bare}`);
    if (bare !== host) pushUnique(`sc-domain:${host}`);
    pushUnique(`https://${bare}/`);
    pushUnique(`https://www.${bare}/`);
    return candidates;
  }

  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const u = new URL(cleaned);
      // URL.toString() guarantees a trailing slash on root paths (e.g. "https://lensaplus.com/")
      const normalizedUrl =
        u.pathname && u.pathname !== "/" && !u.pathname.endsWith("/")
          ? `${u.toString()}/`
          : u.toString();
      const host = u.hostname.toLowerCase();
      const bare = host.replace(/^www\./, "");
      pushUnique(normalizedUrl);
      pushUnique(`sc-domain:${bare}`);
      pushUnique(`https://${bare}/`);
      pushUnique(`https://www.${bare}/`);
      return candidates;
    } catch {
      return [];
    }
  }

  // Bare domain (e.g. "lensaplus.com" or "lensaplus.com/path")
  const host = cleaned.replace(/\/.*$/, "").trim().toLowerCase();
  if (!host || !host.includes(".")) return [];
  const bare = host.replace(/^www\./, "");
  pushUnique(`sc-domain:${bare}`);
  pushUnique(`https://${bare}/`);
  pushUnique(`https://www.${bare}/`);
  return candidates;
}

async function getSiteUrlCandidates(override?: string): Promise<string[]> {
  if (override && override.trim().length > 0) {
    const list = buildGscCandidateSiteUrls(override);
    if (list.length > 0) return list;
  }

  const allCandidates: string[] = [];
  const addFrom = (raw: string | null | undefined) => {
    for (const c of buildGscCandidateSiteUrls(raw)) {
      if (!allCandidates.includes(c)) allCandidates.push(c);
    }
  };

  try {
    const [gscRow, webRow] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: "gsc_site_url" } }),
      prisma.systemSetting.findUnique({ where: { key: "website_url" } }),
    ]);
    addFrom(gscRow?.value);
    addFrom(process.env.GSC_SITE_URL);
    addFrom(webRow?.value);
  } catch {
    addFrom(process.env.GSC_SITE_URL);
  }

  addFrom(process.env.NEXT_PUBLIC_APP_URL);
  return allCandidates;
}

function isRetryableSitePermissionError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("sufficient permission") ||
    lower.includes("user does not have") ||
    lower.includes("not found") ||
    lower.includes("403") ||
    lower.includes("404")
  );
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
  const from = opts.from <= opts.to ? opts.from : opts.to;
  const to = opts.from <= opts.to ? opts.to : opts.from;

  const key = cacheKey({ from, to, siteUrl: opts.siteUrl });
  if (!opts.refresh) {
    const cached = getCached(key);
    if (cached) return cached;
  }

  const { credentials, error: credError } = await getCredentials();
  if (!credentials) {
    return emptyStats(credError ?? "Not configured: missing google_credentials_json");
  }

  const candidates = await getSiteUrlCandidates(opts.siteUrl);
  if (candidates.length === 0) {
    return emptyStats("Not configured: missing gsc_site_url");
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [GSC_SCOPE],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });

  let firstError: string | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const siteUrl = candidates[i];
    try {
      const totalsP = withTimeout(
        searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: from,
            endDate: to,
            rowLimit: 1,
          },
        }),
      );

      const queriesP = withTimeout(
        searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: from,
            endDate: to,
            dimensions: ["query"],
            rowLimit: 10,
          },
        }),
      );

      const pagesP = withTimeout(
        searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: from,
            endDate: to,
            dimensions: ["page"],
            rowLimit: 10,
          },
        }),
      );

      const dailyP = withTimeout(
        searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: from,
            endDate: to,
            dimensions: ["date"],
            rowLimit: 366,
          },
        }),
      );

      const [totalsRes, queriesRes, pagesRes, dailyRes] = await Promise.all([
        totalsP,
        queriesP,
        pagesP,
        dailyP,
      ]);

      const totalsRow = totalsRes.data.rows?.[0];
      const impressions = Number(totalsRow?.impressions ?? 0) || 0;
      const clicks = Number(totalsRow?.clicks ?? 0) || 0;
      const ctr = Number(totalsRow?.ctr ?? 0) || 0;
      const avgPosition = Number(totalsRow?.position ?? 0) || 0;

      const topQueries = (queriesRes.data.rows ?? []).map((r) => ({
        query: r.keys?.[0] ?? "",
        impressions: Number(r.impressions ?? 0) || 0,
        clicks: Number(r.clicks ?? 0) || 0,
        ctr: Number(r.ctr ?? 0) || 0,
        position: Number(r.position ?? 0) || 0,
      }));

      const topPages = (pagesRes.data.rows ?? []).map((r) => ({
        page: r.keys?.[0] ?? "",
        impressions: Number(r.impressions ?? 0) || 0,
        clicks: Number(r.clicks ?? 0) || 0,
        ctr: Number(r.ctr ?? 0) || 0,
        position: Number(r.position ?? 0) || 0,
      }));

      const dailyTrend = (dailyRes.data.rows ?? []).map((r) => ({
        date: r.keys?.[0] ?? "",
        impressions: Number(r.impressions ?? 0) || 0,
        clicks: Number(r.clicks ?? 0) || 0,
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
      if (!firstError) firstError = msg;
      // Only try alternate property format (sc-domain vs https://) if this was a site permission/404 error
      if (!isRetryableSitePermissionError(msg)) {
        break;
      }
    }
  }

  return emptyStats(firstError ?? "Gagal memuat data Google Search Console");
}
