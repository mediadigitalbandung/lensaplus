/**
 * Live USD→IDR exchange rate for AI cost reporting.
 *
 * Precedence:
 *   1. Manual override — SystemSetting `usd_idr_rate` (>0) pins the rate.
 *   2. Auto: fetched from a free FX API (open.er-api.com), cached in-memory +
 *      persisted to SystemSetting (`usd_idr_rate_auto` + `_at`) for ~12h. Stale
 *      values refresh in the background while the last-known rate is returned.
 *   3. Fallback default if nothing is available yet.
 *
 * IMPORTANT: this is only for DISPLAY of the *current* rate and for stamping the
 * rate onto a usage row AT RECORD TIME. Historical AIUsageLog rows store their
 * own frozen `costIdr` + `usdIdrRate`, so past spend never changes when the
 * rupiah moves. Never throws.
 */

import { prisma } from "./prisma";

const DEFAULT_RATE = 16_500;
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const FX_URL = "https://open.er-api.com/v6/latest/USD";
const AUTO_KEY = "usd_idr_rate_auto";
const AUTO_AT_KEY = "usd_idr_rate_auto_at";

let mem: { rate: number; at: number } | null = null;

async function readSetting(key: string): Promise<string | null> {
  try {
    const r = await prisma.systemSetting.findUnique({ where: { key } });
    return r?.value ?? null;
  } catch {
    return null;
  }
}

async function fetchLive(): Promise<number | null> {
  try {
    const res = await fetch(FX_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: { IDR?: number } };
    const idr = data?.rates?.IDR;
    return typeof idr === "number" && idr > 0 ? idr : null;
  } catch {
    return null;
  }
}

async function refresh(): Promise<number | null> {
  const rate = await fetchLive();
  if (!rate) return null;
  const at = Date.now();
  mem = { rate, at };
  try {
    await prisma.systemSetting.upsert({ where: { key: AUTO_KEY }, update: { value: String(rate) }, create: { key: AUTO_KEY, value: String(rate) } });
    await prisma.systemSetting.upsert({ where: { key: AUTO_AT_KEY }, update: { value: String(at) }, create: { key: AUTO_AT_KEY, value: String(at) } });
  } catch {
    /* persistence is best-effort */
  }
  return rate;
}

/** Current USD→IDR rate (manual override wins; else live/cached). Never throws. */
export async function getUsdIdrRate(): Promise<number> {
  // 1) Manual override pins the rate.
  const manual = parseFloat((await readSetting("usd_idr_rate")) ?? "");
  if (Number.isFinite(manual) && manual > 0) return manual;

  // 2) Fresh in-memory cache.
  if (mem && Date.now() - mem.at < TTL_MS) return mem.rate;

  // 3) Seed from persisted cache (survives restarts).
  if (!mem) {
    const v = parseFloat((await readSetting(AUTO_KEY)) ?? "");
    const at = parseInt((await readSetting(AUTO_AT_KEY)) ?? "", 10);
    if (Number.isFinite(v) && v > 0) mem = { rate: v, at: Number.isFinite(at) ? at : 0 };
  }

  // 4) Have a value (maybe stale) → return it, refresh in background if stale.
  if (mem) {
    if (Date.now() - mem.at >= TTL_MS) void refresh();
    return mem.rate;
  }

  // 5) Nothing yet → fetch once now.
  return (await refresh()) ?? DEFAULT_RATE;
}

/** True if the rate is pinned by a manual `usd_idr_rate` setting (for UI labels). */
export async function isUsdIdrManual(): Promise<boolean> {
  const v = parseFloat((await readSetting("usd_idr_rate")) ?? "");
  return Number.isFinite(v) && v > 0;
}

export { DEFAULT_RATE };
