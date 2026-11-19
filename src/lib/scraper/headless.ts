/**
 * Headless Chromium fetcher for JavaScript-rendered news sites
 * (Bank BJB, Persib, etc.) whose article cards are injected by
 * client-side JS and therefore invisible to cheerio.
 *
 * Security & resource hardening:
 *  - Bounded concurrency semaphore (max 3 active Chromium pages at once) so
 *    parallel scrapes cannot OOM the VPS.
 *  - Every allowed HTTP(S) request (document navigations + subresources) is
 *    fulfilled in Node via `safePublicFetch()` + `route.fulfill()`, never via
 *    Chromium `route.continue()`, eliminating Chromium's independent second DNS
 *    lookup (TOCTOU DNS rebinding SSRF) and enforcing strict response type and
 *    byte limits.
 *
 * Lazy-loaded so the rest of the codebase never imports `playwright`
 * unless headless mode is actually triggered.
 */

import type { Browser, BrowserContext, Page } from "playwright";
import {
  assertSafePublicUrl,
  safePublicFetch,
  userAgent as defaultUserAgent,
} from "./fetch";

const NAV_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 15_000;
const SETTLE_MS = 800;
const IDLE_CLOSE_MS = 5 * 60 * 1000;

export const MAX_CONCURRENT_HEADLESS_PAGES = 3;
const MAX_QUEUED_PAGES = 12;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB max for HTML/document
const MAX_SUBRESOURCE_BYTES = 2 * 1024 * 1024; // 2 MB max for script/xhr/css/etc.
const MAX_PAGE_TOTAL_BYTES = 15 * 1024 * 1024; // 15 MB cumulative budget per page

const BLOCKED_RESOURCE_TYPES = new Set([
  "font",
  "media",
  "websocket",
  "eventsource",
  "beacon",
  "manifest",
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
]);

const FORWARDED_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "origin",
  "referer",
  "user-agent",
  "x-requested-with",
]);

let _browser: Browser | null = null;
let _starting: Promise<Browser> | null = null;
let _activePages = 0;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;
const _waitQueue: Array<() => void> = [];

function clearIdleTimer(): void {
  if (_idleTimer) {
    clearTimeout(_idleTimer);
    _idleTimer = null;
  }
}

function scheduleIdleClose(): void {
  clearIdleTimer();
  if (_activePages > 0 || !_browser) return;
  _idleTimer = setTimeout(() => {
    if (_activePages === 0) {
      void shutdownHeadlessBrowser();
    }
  }, IDLE_CLOSE_MS);
  if (typeof _idleTimer.unref === "function") {
    _idleTimer.unref();
  }
}

async function acquirePageSlot(): Promise<void> {
  if (_activePages < MAX_CONCURRENT_HEADLESS_PAGES) {
    _activePages++;
    return;
  }
  if (_waitQueue.length >= MAX_QUEUED_PAGES) {
    throw new Error(
      "Headless browser sedang sibuk (batas antrean halaman paralel tercapai). Coba lagi sebentar.",
    );
  }
  await new Promise<void>((resolve) => {
    _waitQueue.push(resolve);
  });
  // Active slot ownership is transferred directly by releasePageSlot().
}

function releasePageSlot(): void {
  const next = _waitQueue.shift();
  if (next) {
    next();
  } else {
    _activePages = Math.max(0, _activePages - 1);
    scheduleIdleClose();
  }
}

async function readResponseBufferWithCap(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const lenHeader = response.headers.get("content-length");
  if (lenHeader) {
    const declared = Number.parseInt(lenHeader, 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel?.().catch(() => {});
      throw new Error(`Headless response too large: ${declared} bytes (cap ${maxBytes})`);
    }
  }

  const reader = response.body?.getReader?.();
  if (!reader) {
    const ab = await response.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      throw new Error(`Headless response exceeded ${maxBytes} bytes`);
    }
    return Buffer.from(ab);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new Error(`Headless response exceeded ${maxBytes} bytes`);
        }
        chunks.push(value);
      }
    }
  } catch (err) {
    await reader.cancel().catch(() => {});
    throw err;
  }
  return Buffer.concat(chunks, total);
}

function buildSafeForwardHeaders(
  rawHeaders: Record<string, string>,
  fallbackUserAgent: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(rawHeaders)) {
    const lower = key.toLowerCase();
    if (FORWARDED_REQUEST_HEADERS.has(lower) && typeof val === "string") {
      out[lower] = val;
    }
  }
  if (!out["user-agent"]) {
    out["user-agent"] = fallbackUserAgent;
  }
  if (!out["accept-language"]) {
    out["accept-language"] = "id-ID,id;q=0.9,en;q=0.5";
  }
  return out;
}

function sanitizeResponseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!STRIPPED_RESPONSE_HEADERS.has(lower)) {
      out[key] = value;
    }
  });
  return out;
}

async function startBrowser(): Promise<Browser> {
  try {
    const { chromium } = await import("playwright");
    return await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--disable-gpu",
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Headless browser (Playwright Chromium) gagal dijalankan: ${msg.slice(0, 200)}`,
    );
  }
}

async function getBrowser(): Promise<Browser> {
  clearIdleTimer();
  if (_browser && _browser.isConnected()) return _browser;
  if (_starting) return _starting;
  _starting = startBrowser().then(
    (b) => {
      _browser = b;
      _starting = null;
      b.on("disconnected", () => {
        _browser = null;
        clearIdleTimer();
      });
      return b;
    },
    (err) => {
      _starting = null;
      throw err;
    },
  );
  return _starting;
}

/**
 * Render `url` in headless Chromium and return the fully-hydrated
 * outer HTML. SSRF-guarded before launching and proxied through
 * `safePublicFetch()` + `route.fulfill()` on every HTTP(S) request.
 */
export async function fetchHtmlHeadless(
  url: string,
  options: {
    timeoutMs?: number;
    waitForSelector?: string | null;
    userAgent?: string;
  } = {},
): Promise<{ html: string; finalUrl: string }> {
  // SSRF guard before acquiring a browser slot or launching Chromium
  await assertSafePublicUrl(url);

  await acquirePageSlot();
  let ctx: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    const browser = await getBrowser();
    const resolvedUa = options.userAgent ?? defaultUserAgent();

    ctx = await browser.newContext({
      userAgent: resolvedUa,
      locale: "id-ID",
      viewport: { width: 1366, height: 900 },
      javaScriptEnabled: true,
    });

    let pageTotalBytes = 0;
    let resolvedDocFinalUrl: string | null = null;

    // Intercept EVERY request so Chromium never performs direct DNS/socket I/O.
    // All allowed HTTP(S) requests are fulfilled via Node's safePublicFetch().
    await ctx.route("**/*", async (route) => {
      const req = route.request();
      const resourceType = req.resourceType();
      if (BLOCKED_RESOURCE_TYPES.has(resourceType)) {
        return route.abort().catch(() => {});
      }

      const reqUrl = req.url();
      if (/^(data|blob):/i.test(reqUrl)) {
        return (req.isNavigationRequest() ? route.abort() : route.continue()).catch(() => {});
      }
      if (!/^https?:\/\//i.test(reqUrl)) {
        return route.abort().catch(() => {});
      }
      if (
        /google-analytics|googletagmanager|facebook\.net|doubleclick|hotjar|segment|matomo/i.test(
          reqUrl,
        )
      ) {
        return route.abort().catch(() => {});
      }

      const isDocument = resourceType === "document";
      const remainingBudget = MAX_PAGE_TOTAL_BYTES - pageTotalBytes;
      if (remainingBudget <= 0) {
        return route.abort("blockedbyclient").catch(() => {});
      }
      const perReqCap = Math.min(
        isDocument ? MAX_DOCUMENT_BYTES : MAX_SUBRESOURCE_BYTES,
        remainingBudget,
      );

      try {
        const method = req.method().toUpperCase();
        const postBuf = method !== "GET" && method !== "HEAD" ? req.postDataBuffer() : null;
        const headers = buildSafeForwardHeaders(req.headers(), resolvedUa);

        const { response, finalUrl } = await safePublicFetch(reqUrl, {
          method,
          headers,
          body: postBuf ? new Uint8Array(postBuf) : undefined,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const contentType = response.headers.get("content-type") || "";
        if (
          isDocument &&
          contentType &&
          !/html|xml|xhtml|text\/plain/i.test(contentType)
        ) {
          await response.body?.cancel?.().catch(() => {});
          return route.abort("blockedbyclient").catch(() => {});
        }

        const body = await readResponseBufferWithCap(response, perReqCap);
        pageTotalBytes += body.byteLength;

        if (isDocument && req.isNavigationRequest() && page && req.frame() === page.mainFrame()) {
          resolvedDocFinalUrl = finalUrl;
        }

        return await route.fulfill({
          status: response.status,
          headers: sanitizeResponseHeaders(response.headers),
          body,
        });
      } catch {
        return route.abort("blockedbyclient").catch(() => {});
      }
    });

    page = await ctx.newPage();

    // Use domcontentloaded first so sites with persistent analytics/beacons
    // never hang for 30s waiting for networkidle.
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs ?? NAV_TIMEOUT_MS,
    });
    if (options.waitForSelector) {
      await page
        .waitForSelector(options.waitForSelector, { timeout: 8_000 })
        .catch(() => {
          /* keep going even if the selector never appears */
        });
    } else {
      await page
        .waitForLoadState("networkidle", { timeout: 5_000 })
        .catch(() => {
          /* proceed with rendered DOM even if background beacons stay open */
        });
    }
    await page.waitForTimeout(SETTLE_MS);
    const html = await page.content();
    const finalUrl = resolvedDocFinalUrl || page.url();
    return { html, finalUrl };
  } finally {
    if (page) await page.close().catch(() => {});
    if (ctx) await ctx.close().catch(() => {});
    releasePageSlot();
  }
}

/**
 * Force-shutdown the shared browser.
 */
export async function shutdownHeadlessBrowser(): Promise<void> {
  clearIdleTimer();
  if (_browser) {
    try {
      await _browser.close();
    } catch {
      // ignore
    }
    _browser = null;
  }
}
