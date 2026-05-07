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
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        delete event.request.headers["x-cron-secret"];
      }
      if (typeof event.request?.query_string === "string") {
        event.request.query_string = event.request.query_string.replace(
          /(token|key|secret|password)=[^&]+/gi,
          "$1=***",
        );
      }
      if (event.extra) {
        for (const k of Object.keys(event.extra)) {
          const v = event.extra[k];
          if (typeof v === "string") {
            event.extra[k] = v
              .replace(/[\w._%+-]+@[\w.-]+\.\w+/g, "***@***")
              .replace(/\b\d{10,}\b/g, "***");
          }
        }
      }
      return event;
    },
  });
}
