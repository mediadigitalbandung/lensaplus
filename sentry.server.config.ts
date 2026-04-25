/**
 * Sentry server-side init (Node runtime).
 * Auto-disabled if SENTRY_DSN is empty/unset.
 */

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV || "production",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    // Don't capture expected errors
    ignoreErrors: [
      "Unauthorized",
      "Forbidden",
      "Not configured",
    ],
  });
}
