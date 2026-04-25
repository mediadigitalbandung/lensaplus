/**
 * Sentry browser-side init.
 * Auto-disabled if NEXT_PUBLIC_SENTRY_DSN is empty/unset.
 */

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV || "production",
    // Sample 10% of transactions in production, 100% in dev
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Ignore noisy errors
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      "ChunkLoadError",
      "Network request failed",
    ],
    // Don't send PII
    sendDefaultPii: false,
  });
}
