/**
 * Polite fetch wrapper for upstream news sites.
 * - Identifies as "Lensaplus-Scraper" so admins can see who is hitting them.
 * - Hard timeout to keep cron predictable.
 * - Forwards a sane Accept-Language header for ID-first content negotiation.
 * - SSRF guard: blocks private/loopback/link-local hosts before any network I/O.
 */

const DEFAULT_USER_AGENT =
  "Lensaplus-Scraper/1.0 (+https://lensaplus.com/kontak)";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Returns true when the hostname resolves to a private/loopback/link-local
 * address that should never be reachable from a public scraper.
 * Mirrors the guard already present in download-image.ts.
 */
export function isPrivateHost(host: string): boolean {
  if (host === "localhost") return true;
  // IPv4 RFC1918 + loopback + link-local (including cloud metadata endpoint)
  if (
    /^(10\.|127\.|169\.254\.|192\.168\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return true;
  }
  // IPv6 loopback / link-local
  if (host === "::1" || /^fe80:/i.test(host)) return true;
  return false;
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
  // SSRF guard — must run before any network call.
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

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
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
    if (!/html|xml/i.test(contentType)) {
      throw new Error(`Unexpected content-type: ${contentType}`);
    }
    const html = await response.text();
    return {
      html,
      finalUrl: response.url || url,
      contentType,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function userAgent(): string {
  return DEFAULT_USER_AGENT;
}
