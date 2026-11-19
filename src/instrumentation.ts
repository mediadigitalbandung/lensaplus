/**
 * Next.js 16 instrumentation entry point (Node.js + Edge runtimes).
 * Required by Next.js 16 Turbopack + @sentry/nextjs v10 to initialize Sentry
 * on the server and capture unhandled request errors.
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
