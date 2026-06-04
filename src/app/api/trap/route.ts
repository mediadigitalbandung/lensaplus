import { NextRequest, NextResponse } from "next/server";
import { getClientIp, banIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Honeypot endpoint.
 *
 * It is linked ONLY from a hidden, aria-hidden, rel=nofollow anchor that humans
 * never see/focus and that robots.txt disallows (so compliant crawlers like
 * Googlebot never follow it). Therefore any request that reaches this path is
 * almost certainly a misbehaving scraper crawling every <a href> — so we ban
 * its IP at the app layer (blocks the public JSON endpoints for a few hours).
 *
 * NOTE: the app-layer ban only protects the API routes (same Node process).
 * For a hard, full-site EDGE block of these IPs, add a Cloudflare WAF/firewall
 * rule on this path (URI Path equals "/api/trap" → Block) — see the audit notes.
 *
 * We log the hit (visible in PM2 logs) and return an innocuous 200 so the bot
 * doesn't realise it tripped a trap.
 */
function handler(req: NextRequest) {
  const ip = getClientIp(req);
  banIp(ip);
  const ua = req.headers.get("user-agent") || "unknown";
  console.warn(`[honeypot] banned scraper ip=${ip} ua="${ua}" path=/api/trap`);
  return new NextResponse("ok", {
    status: 200,
    headers: { "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" },
  });
}

export const GET = handler;
export const POST = handler;
export const HEAD = handler;
