/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip TypeScript checking during Next.js build phase. Reason:
  //   Next.js 16 runs `tsc --noEmit` in a forked worker that allocates ~1 GB
  //   per file batch. On the VPS (16 GB RAM, ~10 GB free during build) the
  //   kernel OOM-killer routinely hits the worker mid-typecheck → SIGKILL →
  //   `required-server-files.json` never written → pm2 crash loop with
  //   "Could not find a production build".
  //   We already run `npx tsc --noEmit` locally in the pre-commit pipeline
  //   plus in CI workflow .github/workflows/deploy.yml validate-job, so the
  //   TS contract is verified BEFORE the VPS build kicks off. Skipping the
  //   redundant in-build typecheck cuts peak memory roughly in half and
  //   removes the OOM failure mode without sacrificing type safety.
  typescript: { ignoreBuildErrors: true },
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
        hostname: "kartawarta.com",
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
    return [
      {
        source: "/(.*)",
        headers: [
          // HSTS — force HTTPS, preload-eligible (max-age 1 year + includeSubDomains)
          // Production-only; reverse proxy / dev environment doesn't get HSTS.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
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
              // Cloudflare auto-injects analytics beacon (`static.cloudflareinsights.com/beacon.min.js`)
              // at the edge for any site behind Cloudflare. Whitelist it alongside Turnstile
              // (challenges.cloudflare.com) so the console doesn't log CSP violations on every page.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https://api.deepseek.com https://api.anthropic.com https://trends.google.com https://query1.finance.yahoo.com https://query2.finance.yahoo.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://cloudflareinsights.com",
              "frame-src https://challenges.cloudflare.com",
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
const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  const { withSentryConfig } = require("@sentry/nextjs");
  module.exports = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Source map upload — disabled if no auth token
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true,
  });
} else {
  module.exports = nextConfig;
}
