/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enforce TypeScript type safety during `next build` so type errors always
  // block broken production bundles. Early `npx tsc --noEmit` gates also run
  // in `deploy.ps1` and `scripts/deploy-vps.sh`.
  typescript: { ignoreBuildErrors: false },
  // Exclude uploads directory from NFT file tracing to avoid bundling thousands of uploads in SSG builds
  outputFileTracingExcludes: {
    "*": [
      "./public/uploads/**",
      "./public/uploads/**/*",
    ],
  },
  // Keep `ffmpeg-static` out of the webpack server bundle. It resolves its
  // binary path from `__dirname`; bundling rewrites that and breaks the path,
  // so the Reel video renderer (src/lib/social/video-renderer.ts) would fail
  // to find the ffmpeg binary at runtime. Externalizing keeps the real path.
  serverExternalPackages: ["ffmpeg-static"],
  // ESLint config key removed — Next.js 16 deprecated `eslint` in next.config.js
  // (see https://nextjs.org/docs/app/api-reference/cli/next#next-lint-options).
  // Lint sudah jalan di CI + local pre-commit, jadi tidak perlu di-build phase.
  images: {
    // Disable Next.js's image optimizer entirely. Reasons:
    //   1. The /_next/image proxy fetches /uploads/* from Next.js itself,
    //      and `next start` caches the public/ file list at startup, so
    //      newly-uploaded media returns 404 from the optimizer until PM2
    //      restart — even though Nginx serves the same path fine.
    //   2. Our upload pipeline already converts images to WebP at 1200px max,
    //      so optimizer adds no real benefit.
    //   3. Nginx serves /uploads/* directly with 30-day immutable cache.
    //   4. Unsplash images are already CDN-served and well-sized.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lensaplus.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "http",
        hostname: "145.79.15.99",
      },
      {
        protocol: "https",
        hostname: "145.79.15.99.nip.io",
      },
    ],
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      ...(!isProd ? ["'unsafe-eval'"] : []),
      "https://challenges.cloudflare.com",
      "https://static.cloudflareinsights.com",
      "https://pagead2.googlesyndication.com",
      "https://adservice.google.com",
      "https://partner.googleadservices.com",
      "https://fundingchoicesmessages.google.com",
      "https://*.adtrafficquality.google",
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
    ].join(" ");
    const imgSrc = isProd
      ? "img-src 'self' data: blob: https:"
      : "img-src 'self' data: blob: https: http:";

    return [
      {
        source: "/(.*)",
        headers: [
          // HSTS — force HTTPS, preload-eligible (max-age 1 year + includeSubDomains)
          // Production-only; reverse proxy / dev environment doesn't get HSTS.
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Control referrer info
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // XSS protection
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Disable dangerous browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "object-src 'none'",
              // Cloudflare auto-injects analytics beacon (`static.cloudflareinsights.com/beacon.min.js`)
              // at the edge for any site behind Cloudflare. Whitelist it alongside Turnstile
              // (challenges.cloudflare.com) so the console doesn't log CSP violations on every page.
              // Whitelist Google AdSense + Funding Choices CMP + Google Tag Manager / GA4
              `script-src ${scriptSrc}`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              imgSrc,
              // Whitelist Google AdSense + Funding Choices + Google Tag Manager / GA4 connections
              "connect-src 'self' https://api.deepseek.com https://api.anthropic.com https://trends.google.com https://query1.finance.yahoo.com https://query2.finance.yahoo.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://cloudflareinsights.com https://pagead2.googlesyndication.com https://adservice.google.com https://*.doubleclick.net https://*.googlesyndication.com https://fundingchoicesmessages.google.com https://*.adtrafficquality.google https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
              // Whitelist YouTube embeds + Cloudflare Turnstile + Google AdSense + Funding Choices + GTM frames
              "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://challenges.cloudflare.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.safeframe.googlesyndication.com https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com https://*.adtrafficquality.google https://www.googletagmanager.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          // Prevent DNS prefetch abuse
          { key: "X-DNS-Prefetch-Control", value: "on" },
          // Cross-Origin policies
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  // Disable x-powered-by header
  poweredByHeader: false,
  async redirects() {
    return [
      // Browser standard (.well-known/change-password) — password managers
      // and Safari point users here when they want to change their pass.
      // Trust signal weighed by Chrome Safe Browsing & Apple ITP.
      {
        source: "/.well-known/change-password",
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

// Wrap with Sentry only when SENTRY_DSN is configured.
// When DSN is empty, return raw config — no source-map upload, no overhead.
// Runtime initialization is handled via Next.js 16 instrumentation hooks:
//   - src/instrumentation.ts (Node.js + Edge via sentry.server/edge.config.ts)
//   - src/instrumentation-client.ts (Browser + onRouterTransitionStart)
const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  const { withSentryConfig } = require("@sentry/nextjs");
  const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);
  module.exports = withSentryConfig(nextConfig, {
    silent: true,
    telemetry: false,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Source map upload & release creation — enabled only when SENTRY_AUTH_TOKEN is set.
    // On Next.js 16 Turbopack + @sentry/nextjs v10, uploads run via
    // compiler.runAfterProductionCompile and clean up .map artifacts afterward.
    sourcemaps: {
      disable: !hasSentryAuthToken,
      deleteSourcemapsAfterUpload: hasSentryAuthToken,
    },
    release: {
      create: hasSentryAuthToken,
    },
    widenClientFileUpload: true,
    webpack: {
      treeshake: {
        removeDebugLogging: true,
      },
    },
  });
} else {
  module.exports = nextConfig;
}
