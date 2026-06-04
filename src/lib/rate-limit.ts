// Simple in-memory rate limiter for API routes
// In production, use Redis for distributed rate limiting

import { NextResponse } from "next/server";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimitMap.entries());
  for (const [key, value] of entries) {
    if (value.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function rateLimit(
  identifier: string,
  limit: number = 30,
  windowMs: number = 60 * 1000 // 1 minute
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
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
  const entry = rateLimitMap.get(`loginfail:${ip}`);
  return !!entry && entry.resetAt > Date.now() && entry.count >= LOGIN_FAIL_LIMIT;
}

export function registerLoginFailure(ip: string): void {
  const key = `loginfail:${ip}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
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

// ── Real client IP behind Cloudflare/proxies ────────────────────────────────
// Order matters: `cf-connecting-ip` is set by Cloudflare to the TRUE visitor IP
// (so per-visitor limits work instead of bucketing everyone under a CF edge IP);
// `x-forwarded-for` can be a chain "<client>, <proxy>…" so we take the FIRST
// hop; `x-real-ip` is a last resort.
export function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// ── Bot guard: short-lived IP ban list (honeypot / abuse) ───────────────────
// In-memory like the rate limiter (per-process, clears on deploy). Cloudflare is
// the durable EDGE enforcer; this is a fast app-layer backstop for the public
// JSON endpoints. Bans are deliberately short so a rare false positive only
// costs a few hours of API access (HTML pages are unaffected).
const bannedIps = new Map<string, number>(); // ip -> expiry (epoch ms)
const BAN_MS = 6 * 60 * 60 * 1000; // 6 hours

export function banIp(ip: string, ms: number = BAN_MS): void {
  if (!ip || ip === "unknown") return;
  bannedIps.set(ip, Date.now() + ms);
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
