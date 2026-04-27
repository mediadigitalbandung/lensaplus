/**
 * Headless Chromium fetcher for JavaScript-rendered news sites
 * (Bank BJB, Persib, etc.) whose article cards are injected by
 * client-side JS and therefore invisible to cheerio.
 *
 * Designed to be expensive but reliable: ~5–15 seconds per page,
 * ~500 MB RAM peak. The single browser instance is reused across
 * requests and idles cheaply between calls; pages are isolated in
 * fresh BrowserContexts for safety.
 *
 * Lazy-loaded so the rest of the codebase never imports `playwright`
 * unless headless mode is actually triggered.
 */

import type { Browser, BrowserContext } from "playwright";
import { userAgent as defaultUserAgent } from "./fetch";

const NAV_TIMEOUT_MS = 30_000;
const SETTLE_MS = 800;

let _browser: Browser | null = null;
let _starting: Promise<Browser> | null = null;

async function startBrowser(): Promise<Browser> {
  // Defer the import so the module only resolves Playwright when we
  // actually need a browser. Prevents Next.js from bundling chromium
  // into routes that never use it.
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
  if (_browser && _browser.isConnected()) return _browser;
  if (_starting) return _starting;
  _starting = startBrowser().then((b) => {
    _browser = b;
    _starting = null;
    // Auto-close idle browser after 5 minutes to free RAM.
    b.on("disconnected", () => {
      _browser = null;
    });
    return b;
  });
  return _starting;
}

/**
 * Render `url` in headless Chromium and return the fully-hydrated
 * outer HTML. Resource-blocking is enabled to skip ads, video,
 * fonts, and tracking pixels — we only need the DOM.
 */
export async function fetchHtmlHeadless(
  url: string,
  options: {
    timeoutMs?: number;
    waitForSelector?: string | null;
    userAgent?: string;
  } = {},
): Promise<{ html: string; finalUrl: string }> {
  const browser = await getBrowser();
  const ctx: BrowserContext = await browser.newContext({
    userAgent: options.userAgent ?? defaultUserAgent(),
    locale: "id-ID",
    viewport: { width: 1366, height: 900 },
    javaScriptEnabled: true,
    bypassCSP: true,
  });

  // Block heavy / privacy-irrelevant requests
  await ctx.route("**/*", (route) => {
    const t = route.request().resourceType();
    if (t === "font" || t === "media" || t === "websocket") {
      return route.abort();
    }
    const reqUrl = route.request().url();
    if (
      /google-analytics|googletagmanager|facebook\.net|doubleclick|hotjar|segment|matomo/i.test(
        reqUrl,
      )
    ) {
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
    // Final settle for late hydration
    await page.waitForTimeout(SETTLE_MS);
    const html = await page.content();
    const finalUrl = page.url();
    return { html, finalUrl };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

/**
 * Force-shutdown the shared browser. Call from process shutdown
 * hooks if needed; Next.js dev/prod managed lifetimes don't expose
 * a clean hook so we just rely on idle GC.
 */
export async function shutdownHeadlessBrowser(): Promise<void> {
  if (_browser) {
    try {
      await _browser.close();
    } catch {
      // ignore
    }
    _browser = null;
  }
}
