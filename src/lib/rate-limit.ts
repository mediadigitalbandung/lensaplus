// Simple in-memory rate limiter for API routes
// In production, use Redis for distributed rate limiting

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
