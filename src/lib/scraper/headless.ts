/**
 * Headless Chromium fetcher for JavaScript-rendered news sites
 * (Bank BJB, Persib, etc.) whose article cards are injected by
 * client-side JS and therefore invisible to cheerio.
 *
 * Designed to be expensive but reliable: ~5–15 seconds per page,
 * ~500 MB RAM peak. The single browser instance is reused across
 * requests and closed after 5 minutes of idle time; pages are isolated
 * in fresh BrowserContexts for safety.
 *
 * Lazy-loaded so the rest of the codebase never imports `playwright`
 * unless headless mode is actually triggered.
 */

import type { Browser, BrowserContext } from "playwright";
import { assertSafePublicUrl, userAgent as defaultUserAgent } from "./fetch";

const NAV_TIMEOUT_MS = 30_000;
const SETTLE_MS = 800;
const IDLE_CLOSE_MS = 5 * 60 * 1000;

let _browser: Browser | null = null;
let _starting: Promise<Browser> | null = null;
let _activePages = 0;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;

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

async function startBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({
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
 * outer HTML. SSRF-guarded before launching and on every network request.
 */
export async function fetchHtmlHeadless(
  url: string,
  options: {
    timeoutMs?: number;
    waitForSelector?: string | null;
    userAgent?: string;
  } = {},
): Promise<{ html: string; finalUrl: string }> {
  // SSRF guard before starting Chromium or creating any context
  await assertSafePublicUrl(url);

  const browser = await getBrowser();
  _activePages++;
  const ctx: BrowserContext = await browser.newContext({
    userAgent: options.userAgent ?? defaultUserAgent(),
    locale: "id-ID",
    viewport: { width: 1366, height: 900 },
    javaScriptEnabled: true,
    bypassCSP: true,
  });

  // Block heavy / tracking / private-network / non-http requests
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const t = req.resourceType();
    if (t === "font" || t === "media" || t === "websocket") {
      return route.abort();
    }
    const reqUrl = req.url();
    if (/^(data|blob):/i.test(reqUrl)) {
      return req.isNavigationRequest() ? route.abort() : route.continue();
    }
    if (!/^https?:\/\//i.test(reqUrl)) {
      return route.abort();
    }
    if (
      /google-analytics|googletagmanager|facebook\.net|doubleclick|hotjar|segment|matomo/i.test(
        reqUrl,
      )
    ) {
      return route.abort();
    }
    try {
      await assertSafePublicUrl(reqUrl);
    } catch {
      return route.abort();
    }
    return route.continue();
  });

  const page = await ctx.newPage();
  try {
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: options.timeoutMs ?? NAV_TIMEOUT_MS,
    });
    if (options.waitForSelector) {
      await page
        .waitForSelector(options.waitForSelector, { timeout: 8_000 })
        .catch(() => {
          /* keep going even if the selector never appears */
        });
    }
    await page.waitForTimeout(SETTLE_MS);
    const html = await page.content();
    const finalUrl = page.url();
    return { html, finalUrl };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
    _activePages = Math.max(0, _activePages - 1);
    scheduleIdleClose();
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
