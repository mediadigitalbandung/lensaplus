// Simple in-memory rate limiter for API routes
// In production, use Redis for distributed rate limiting

import net from "node:net";
import { NextResponse } from "next/server";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_RATE_LIMIT_ENTRIES = 10_000;
const MAX_BANNED_IPS = 5_000;

function ensureRateLimitCapacity(now: number): void {
  if (rateLimitMap.size < MAX_RATE_LIMIT_ENTRIES) return;
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
  while (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
    const oldestKey = rateLimitMap.keys().next().value;
    if (oldestKey === undefined) break;
    rateLimitMap.delete(oldestKey);
  }
}

// Clean up expired entries every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);
if (typeof cleanupTimer === "object" && cleanupTimer !== null && "unref" in cleanupTimer) {
  cleanupTimer.unref();
}

export function rateLimit(
  identifier: string,
  limit: number = 30,
  windowMs: number = 60 * 1000 // 1 minute
): { success: boolean; remaining: number } {
  const safeId = String(identifier || "unknown").slice(0, 200);
  const now = Date.now();
  const entry = rateLimitMap.get(safeId);

  if (!entry || entry.resetAt < now) {
    if (!entry) ensureRateLimitCapacity(now);
    rateLimitMap.set(safeId, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

// Stricter rate limit for auth/login attempts
export function loginRateLimit(ip: string): { success: boolean; remaining: number } {
  return rateLimit(`login:${ip}`, 5, 15 * 60 * 1000); // 5 attempts per 15 min
}

// ── Brute-force login guard ─────────────────────────────────────────────────
// Counts ONLY FAILED login attempts per IP, so a legitimate user who logs in
// successfully never contributes to the counter and is never locked out. After
// LOGIN_FAIL_LIMIT failures within the window, that IP is blocked from further
// attempts (the authorize() flow rejects before touching bcrypt). The counter
// resets after the window or on process restart.
const LOGIN_FAIL_LIMIT = 8;
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;

export function isLoginBlocked(ip: string): boolean {
  const safeIp = String(ip || "").slice(0, 128);
  if (!safeIp || safeIp === "unknown") return false;
  const entry = rateLimitMap.get(`loginfail:${safeIp}`);
  return !!entry && entry.resetAt > Date.now() && entry.count >= LOGIN_FAIL_LIMIT;
}

export function registerLoginFailure(ip: string): void {
  const safeIp = String(ip || "").slice(0, 128);
  if (!safeIp || safeIp === "unknown") return;
  const key = `loginfail:${safeIp}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    if (!entry) ensureRateLimitCapacity(now);
    rateLimitMap.set(key, { count: 1, resetAt: now + LOGIN_FAIL_WINDOW_MS });
  } else {
    entry.count++;
  }
}

// General API rate limit
export function apiRateLimit(ip: string): { success: boolean; remaining: number } {
  return rateLimit(`api:${ip}`, 60, 60 * 1000); // 60 requests per minute
}

// Comment submission rate limit
export function commentRateLimit(ip: string): { success: boolean; remaining: number } {
  return rateLimit(`comment:${ip}`, 3, 5 * 60 * 1000); // 3 comments per 5 min
}

// AI usage rate limit per user
export function aiRateLimit(userId: string): { success: boolean; remaining: number } {
  return rateLimit(`ai:${userId}`, 20, 60 * 60 * 1000); // 20 AI calls per hour
}

// Report submission rate limit
export function reportRateLimit(ip: string): { success: boolean; remaining: number } {
  return rateLimit(`report:${ip}`, 5, 15 * 60 * 1000); // 5 reports per 15 min
}

// Poll vote rate limit — guards against IP-spoofed flood via x-forwarded-for
export function pollVoteRateLimit(ip: string): { success: boolean; remaining: number } {
  return rateLimit(`pollvote:${ip}`, 10, 60 * 1000); // 10 votes per minute per IP
}

// TikTok media upload rate limit per user — each upload writes a file to disk
// (up to 100MB), so cap to avoid disk/CPU abuse from a single editor session.
export function tiktokUploadRateLimit(userId: string): { success: boolean; remaining: number } {
  return rateLimit(`tiktok-upload:${userId}`, 30, 5 * 60 * 1000); // 30 uploads per 5 min
}

// YouTube auto-clip import per user — each job downloads + transcodes + STT +
// cuts, which is heavy, so keep it conservative.
export function youtubeImportRateLimit(userId: string): { success: boolean; remaining: number } {
  return rateLimit(`yt-import:${userId}`, 10, 60 * 60 * 1000); // 10 imports per hour
}

// Two-factor TOTP verification rate limit per user (enable / disable)
export function twoFactorRateLimit(userId: string): { success: boolean; remaining: number } {
  return rateLimit(`2fa:${userId}`, 5, 15 * 60 * 1000); // 5 attempts per 15 min
}

// Push subscription endpoint rate limit per IP
export function pushSubscribeRateLimit(ip: string): { success: boolean; remaining: number } {
  return rateLimit(`pushsub:${ip}`, 20, 15 * 60 * 1000); // 20 requests per 15 min
}

// Ad impression/click tracking rate limit per IP
export function adTrackRateLimit(ip: string): { success: boolean; remaining: number } {
  return rateLimit(`adtrack:${ip}`, 120, 60 * 1000); // 120 events per min per IP
}

// Cloudflare published IPv4 edge CIDRs (https://www.cloudflare.com/ips-v4)
const CF_IPV4_CIDRS: ReadonlyArray< readonly [number, number] > = [
  [0xad_f5_30_00, 20], // 173.245.48.0/20
  [0x67_15_f4_00, 22], // 103.21.244.0/22
  [0x67_16_c8_00, 22], // 103.22.200.0/22
  [0x67_1f_04_00, 22], // 103.31.4.0/22
  [0x8d_65_40_00, 18], // 141.101.64.0/18
  [0x6c_a2_c0_00, 18], // 108.162.192.0/18
  [0xbe_5d_f0_00, 20], // 190.93.240.0/20
  [0xbc_72_60_00, 20], // 188.114.96.0/20
  [0xc5_ea_f0_00, 22], // 197.234.240.0/22
  [0xc6_29_80_00, 17], // 198.41.128.0/17
  [0xa2_9e_00_00, 15], // 162.158.0.0/15
  [0x68_10_00_00, 13], // 104.16.0.0/13
  [0x68_18_00_00, 14], // 104.24.0.0/14
  [0xac_40_00_00, 13], // 172.64.0.0/13
  [0x83_00_48_00, 22], // 131.0.72.0/22
];

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out = ((out << 8) | n) >>> 0;
  }
  return out;
}

function isTrustedCloudflareOrLocalPeer(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const n = ipv4ToUint32(ip);
    if (n === null) return false;
    // Loopback / RFC1918 local proxy
    const a = (n >>> 24) & 0xff;
    const b = (n >>> 16) & 0xff;
    if (a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      return true;
    }
    for (const [netInt, bits] of CF_IPV4_CIDRS) {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      if (((n & mask) >>> 0) === ((netInt & mask) >>> 0)) return true;
    }
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) {
      return true;
    }
    // Cloudflare IPv6 prefixes (2400:cb00::/32, 2606:4700::/32, 2803:f800::/32, 2405:b500::/32, 2405:8100::/32, 2a06:98c0::/29, 2c0f:f248::/32)
    return (
      lower.startsWith("2400:cb00:") ||
      lower.startsWith("2606:4700:") ||
      lower.startsWith("2803:f800:") ||
      lower.startsWith("2405:b500:") ||
      lower.startsWith("2405:8100:") ||
      lower.startsWith("2a06:98c") ||
      lower.startsWith("2c0f:f248:")
    );
  }
  return false;
}

function normalizeCandidateIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let clean = raw.trim();
  if (!clean || clean.length > 64) return null;
  if (clean.startsWith("[") && clean.includes("]")) {
    clean = clean.slice(1, clean.indexOf("]"));
  }
  if (clean.toLowerCase().startsWith("::ffff:")) {
    const v4 = clean.slice(7);
    if (net.isIP(v4) === 4) clean = v4;
  }
  return net.isIP(clean) !== 0 ? clean : null;
}

function readHeader(
  headers: Headers | Record<string, string | string[] | undefined> | null | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  const rec = headers as Record<string, string | string[] | undefined>;
  const val = rec[name] ?? rec[name.toLowerCase()];
  if (Array.isArray(val)) return val[0] ?? null;
  return typeof val === "string" ? val : null;
}

/**
 * Extract the real client IP while defending against spoofed `cf-connecting-ip`
 * and `x-forwarded-for` headers when origin/Nginx is reached directly:
 *   - Nginx sets `X-Real-IP $remote_addr` (the TCP socket peer).
 *   - `cf-connecting-ip` is trusted ONLY when either:
 *       (a) `CLOUDFLARE_ORIGIN_SECRET` is configured and matched by `x-cf-origin-secret`, OR
 *       (b) `X-Real-IP` is a trusted Cloudflare edge / local proxy IP (or absent in dev/tests).
 *   - If `X-Real-IP` is an untrusted public IP (direct origin bypass), `X-Real-IP` wins
 *     so rotating `cf-connecting-ip` or `x-forwarded-for` cannot bypass rate limits.
 */
export function getClientIpFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined> | null | undefined,
): string {
  const realIp = normalizeCandidateIp(readHeader(headers, "x-real-ip"));
  const cfIp = normalizeCandidateIp(readHeader(headers, "cf-connecting-ip"));
  const originSecret = process.env.CLOUDFLARE_ORIGIN_SECRET;

  if (cfIp) {
    if (originSecret) {
      const provided = readHeader(headers, "x-cf-origin-secret") || readHeader(headers, "x-origin-secret");
      if (provided === originSecret) return cfIp;
    } else if (!realIp || isTrustedCloudflareOrLocalPeer(realIp)) {
      return cfIp;
    }
  }

  if (realIp && !isTrustedCloudflareOrLocalPeer(realIp)) {
    return realIp;
  }

  const xff = readHeader(headers, "x-forwarded-for");
  if (xff) {
    const hops = xff
      .split(",")
      .map((s) => normalizeCandidateIp(s))
      .filter((s): s is string => s !== null);
    // Walk from right to left and return the first non-trusted-proxy IP (or leftmost if all trusted)
    for (let i = hops.length - 1; i >= 0; i--) {
      if (!isTrustedCloudflareOrLocalPeer(hops[i])) {
        return hops[i];
      }
    }
    if (hops.length > 0) return hops[0];
  }

  return realIp || "unknown";
}

export function getClientIp(req: Request): string {
  return getClientIpFromHeaders(req.headers);
}

// ── Bot guard: short-lived IP ban list (honeypot / abuse) ───────────────────
const bannedIps = new Map<string, number>(); // ip -> expiry (epoch ms)
const BAN_MS = 6 * 60 * 60 * 1000; // 6 hours

export function banIp(ip: string, ms: number = BAN_MS): void {
  const safeIp = normalizeCandidateIp(ip);
  if (!safeIp) return;
  const now = Date.now();
  if (!bannedIps.has(safeIp) && bannedIps.size >= MAX_BANNED_IPS) {
    for (const [k, exp] of bannedIps.entries()) {
      if (exp < now) bannedIps.delete(k);
    }
    while (bannedIps.size >= MAX_BANNED_IPS) {
      const oldest = bannedIps.keys().next().value;
      if (oldest === undefined) break;
      bannedIps.delete(oldest);
    }
  }
  bannedIps.set(safeIp, now + ms);
}

export function isIpBanned(ip: string): boolean {
  const exp = bannedIps.get(ip);
  if (!exp) return false;
  if (exp < Date.now()) {
    bannedIps.delete(ip);
    return false;
  }
  return true;
}

// Generous limit for public READ endpoints (listings / search / by-slugs):
// a human or the SPA never approaches it, but a scraper paging through the whole
// archive does. Tune down if abuse persists.
export function publicReadRateLimit(ip: string): { success: boolean; remaining: number } {
  return rateLimit(`read:${ip}`, 120, 60 * 1000); // 120 req/min per IP
}

// One-call guard for public read routes: honeypot ban → 403, then rate cap →
// 429. Returns a Response to short-circuit with, or null to continue.
export function guardPublicRead(req: Request): NextResponse | null {
  const ip = getClientIp(req);
  if (isIpBanned(ip)) {
    return NextResponse.json(
      { success: false, error: "Akses diblokir sementara." },
      { status: 403 },
    );
  }
  if (!publicReadRateLimit(ip).success) {
    return NextResponse.json(
      { success: false, error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  return null;
}

