/**
 * Structured logger — thin wrapper around `console` with optional Sentry routing.
 *
 * Goals:
 *  - Provide a stable shape (`{ ts, level, msg, ...ctx }`) so prod logs are
 *    grep-/jq-friendly when shipped through PM2 / journald.
 *  - Auto-attach Sentry breadcrumbs for `warn`/`error` so issues get traced
 *    without callers needing to import Sentry directly.
 *  - Capture full exceptions when caller passes `ctx.err: Error`.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("article published", { feature: "editor", articleId: a.id });
 *   logger.error("send failed", { feature: "social", err, requestId });
 *
 * Note: existing `console.error` callsites are NOT migrated automatically —
 * this module is opt-in. New code SHOULD use it; mass refactor is deferred.
 */

import * as Sentry from "@sentry/nextjs";

type Level = "debug" | "info" | "warn" | "error";

export interface LogContext {
  userId?: string;
  requestId?: string;
  feature?: string;
  err?: unknown;
  [key: string]: unknown;
}

function consoleMethod(level: Level): (...args: unknown[]) => void {
  // `console.debug` exists but PM2 captures it weirdly — use `console.log` instead.
  if (level === "debug") return console.log.bind(console);
  if (level === "info") return console.info.bind(console);
  if (level === "warn") return console.warn.bind(console);
  return console.error.bind(console);
}

function emit(level: Level, msg: string, ctx?: LogContext): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx || {}),
  };

  // Production: structured JSON line. Dev: human-readable.
  const out = consoleMethod(level);
  if (process.env.NODE_ENV === "production") {
    // Errors aren't JSON-serialisable by default — coerce to plain object.
    if (entry.err instanceof Error) {
      (entry as Record<string, unknown>).err = {
        name: entry.err.name,
        message: entry.err.message,
        stack: entry.err.stack,
      };
    }
    try {
      out(JSON.stringify(entry));
    } catch {
      // Fall back if something inside ctx isn't serialisable.
      out(`[${level}] ${msg}`);
    }
  } else {
    out(`[${level}] ${msg}`, ctx || "");
  }

  // Auto-route warn+error to Sentry breadcrumbs for traceability.
  if (level === "warn" || level === "error") {
    try {
      Sentry.addBreadcrumb({
        category: (ctx?.feature as string) || "log",
        level: level === "error" ? "error" : "warning",
        message: msg,
        data: ctx as Record<string, unknown> | undefined,
      });
    } catch {
      // Sentry init may not have run (e.g. in some scripts) — swallow.
    }
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => {
    emit("error", msg, ctx);
    // Errors with a real Error instance also get full exception capture.
    if (ctx?.err instanceof Error) {
      try {
        Sentry.captureException(ctx.err, {
          tags: ctx.feature ? { feature: String(ctx.feature) } : undefined,
          extra: ctx as Record<string, unknown>,
        });
      } catch {
        // Sentry not initialised — already logged via console above.
      }
    }
  },
};

export type Logger = typeof logger;
