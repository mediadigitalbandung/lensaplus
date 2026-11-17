/**
 * Polite fetch wrapper for upstream news sites.
 * - Identifies as "Lensaplus-Scraper" so admins can see who is hitting them.
 * - Hard timeout to keep cron predictable.
 * - Forwards a sane Accept-Language header for ID-first content negotiation.
 * - SSRF guard: blocks private/loopback/link-local/ULA/CGNAT hosts, DNS
 *   resolutions to private IPs, and unsafe HTTP redirects before network I/O.
 */

import dns from "node:dns/promises";
import net from "node:net";

const DEFAULT_USER_AGENT =
  "Lensaplus-Scraper/1.0 (+https://lensaplus.com/kontak)";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

function stripHostDecorations(host: string): string {
  let clean = host.trim().toLowerCase();
  if (clean.startsWith("[") && clean.endsWith("]")) {
    clean = clean.slice(1, -1);
  }
  const pct = clean.indexOf("%");
  if (pct !== -1) clean = clean.slice(0, pct);
  return clean.replace(/\.+$/, "");
}

function isPrivateIpv4Parts(a: number, b: number, c: number): boolean {
  if (a === 0) return true; // 0.0.0.0/8 ("this network")
  if (a === 10) return true; // 10.0.0.0/8 (RFC1918)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC1918)
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 (IETF protocol)
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC1918)
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (benchmark)
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  return false;
}

function expandIpv6(ip: string): number[] | null {
  let addr = ip;
  const lastColon = addr.lastIndexOf(":");
  if (lastColon !== -1 && addr.includes(".")) {
    // Embedded IPv4 tail (e.g. ::ffff:127.0.0.1)
    const v4Part = addr.slice(lastColon + 1);
    const v4Octets = v4Part.split(".").map(Number);
    if (v4Octets.length !== 4 || v4Octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return null;
    }
    const hi = ((v4Octets[0] << 8) | v4Octets[1]).toString(16);
    const lo = ((v4Octets[2] << 8) | v4Octets[3]).toString(16);
    addr = `${addr.slice(0, lastColon)}:${hi}:${lo}`;
  }

  const parts = addr.split("::");
  if (parts.length > 2) return null;

  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const missing = 8 - (left.length + right.length);
  if (parts.length === 1 && missing !== 0) return null;
  if (parts.length === 2 && missing < 0) return null;

  const full = [
    ...left,
    ...Array(Math.max(0, missing)).fill("0"),
    ...right,
  ];
  if (full.length !== 8) return null;
  const words = full.map((h) => Number.parseInt(h, 16));
  if (words.some((w) => Number.isNaN(w) || w < 0 || w > 0xffff)) return null;
  return words;
}

export function isPrivateIp(ip: string): boolean {
  const clean = stripHostDecorations(ip);
  const ipVersion = net.isIP(clean);
  if (ipVersion === 4) {
    const [a, b, c] = clean.split(".").map(Number);
    return isPrivateIpv4Parts(a, b, c);
  }
  if (ipVersion === 6) {
    const words = expandIpv6(clean);
    if (!words) return true; // malformed IPv6 — fail closed
    const allZero = words.slice(0, 7).every((w) => w === 0);
    // :: (unspecified) and ::1 (loopback)
    if (allZero && (words[7] === 0 || words[7] === 1)) return true;
    // ::ffff:0:0/96 (IPv4-mapped IPv6)
    if (
      words[0] === 0 &&
      words[1] === 0 &&
      words[2] === 0 &&
      words[3] === 0 &&
      words[4] === 0 &&
      words[5] === 0xffff
    ) {
      const a = words[6] >> 8;
      const b = words[6] & 0xff;
      const c = words[7] >> 8;
      return isPrivateIpv4Parts(a, b, c);
    }
    // fe80::/10 (link-local)
    if ((words[0] & 0xffc0) === 0xfe80) return true;
    // fc00::/7 (unique local address)
    if ((words[0] & 0xfe00) === 0xfc00) return true;
    // ff00::/8 (multicast)
    if ((words[0] & 0xff00) === 0xff00) return true;
    return false;
  }
  return false;
}

/**
 * Returns true when the hostname is or looks like a private/loopback/link-local
 * address that should never be reachable from a public scraper.
 */
export function isPrivateHost(host: string): boolean {
  const clean = stripHostDecorations(host);
  if (!clean) return true;
  if (
    clean === "localhost" ||
    clean.endsWith(".localhost") ||
    clean.endsWith(".local") ||
    clean.endsWith(".internal")
  ) {
    return true;
  }
  if (net.isIP(clean) !== 0) {
    return isPrivateIp(clean);
  }
  // Conservative prefix match for legacy hostname heuristics
  if (
    /^(0\.|10\.|127\.|169\.254\.|192\.168\.)/.test(clean) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(clean) ||
    /^fe80:/i.test(clean)
  ) {
    return true;
  }
  return false;
}

/**
 * Validate URL protocol, hostname, and DNS-resolved IPs against SSRF.
 * Throws `Invalid URL:` on malformed URLs or `SSRF_BLOCKED:` on disallowed targets.
 */
export async function assertSafePublicUrl(url: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`SSRF_BLOCKED: non-http protocol ${parsed.protocol}`);
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error(`SSRF_BLOCKED: private host disallowed (${parsed.hostname})`);
  }

  const cleanHost = stripHostDecorations(parsed.hostname);
  if (net.isIP(cleanHost) === 0) {
    // Resolve hostname to detect DNS records pointing at loopback/RFC1918/metadata IPs
    const records = await dns.lookup(cleanHost, { all: true }).catch(() => []);
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        throw new Error(`SSRF_BLOCKED: host ${cleanHost} resolved to private IP ${r.address}`);
      }
    }
  }

  return parsed;
}

/**
 * Perform fetch() with manual redirect validation so 3xx hops to private IPs
 * or non-HTTP schemes are blocked before connecting.
 */
export async function safePublicFetch(
  url: string,
  init: RequestInit = {},
  maxRedirects: number = MAX_REDIRECTS,
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafePublicUrl(currentUrl);
    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const loc = response.headers?.get?.("location");
      if (!loc) return { response, finalUrl: currentUrl };
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }
    return { response, finalUrl: response.url || currentUrl };
  }
  throw new Error("SSRF_BLOCKED: too many redirects");
}

export interface FetchHtmlOptions {
  userAgent?: string;
  timeoutMs?: number;
  /** Override Accept-Language; default `id-ID,id;q=0.9,en;q=0.5`. */
  acceptLanguage?: string;
}

export async function fetchHtml(
  url: string,
  options: FetchHtmlOptions = {},
): Promise<{ html: string; finalUrl: string; contentType: string }> {
  await assertSafePublicUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const { response, finalUrl } = await safePublicFetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":
          options.acceptLanguage ?? "id-ID,id;q=0.9,en;q=0.5",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !/html|xml|xhtml|text\/plain/i.test(contentType)) {
      throw new Error(`Unexpected content-type: ${contentType}`);
    }
    const html = await response.text();
    return {
      html,
      finalUrl,
      contentType,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function userAgent(): string {
  return DEFAULT_USER_AGENT;
}
