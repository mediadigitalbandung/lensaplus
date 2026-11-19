/**
 * Sentry edge runtime init (proxy/middleware, edge route handlers).
 * Loaded via `src/instrumentation.ts` when `process.env.NEXT_RUNTIME === "edge"`.
 * Auto-disabled if SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is empty/unset.
 */

import * as Sentry from "@sentry/nextjs";

const SENSITIVE_HEADER_PATTERN =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|x-cron-secret|x-csrf-token|x-xsrf-token|x-session-id|x-setup-key|x-obsidian-token|api-key|apikey)$/i;

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|pwd|secret|token|api[-_]?key|authorization|cookie|private[-_]?key|access[-_]?key|refresh[-_]?token|two[-_]?factor|backup[-_]?code|otp|totp|credit[-_]?card|cvv|session[-_]?id|setup[-_]?key|cron[-_]?secret|encryption[-_]?key)/i;

const QUERY_SECRET_PATTERN =
  /(^|[?&])([^=&/?#\s]*(?:token|key|secret|password|passwd|pwd|auth|session|cookie|otp|code|signature)[^=&/?#\s]*)=([^&#\s]*)/gi;

const EMAIL_PATTERN = /[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
const LONG_DIGITS_PATTERN = /\b\d{10,}\b/g;

function redactString(value: string): string {
  return value
    .replace(QUERY_SECRET_PATTERN, "$1$2=[Filtered]")
    .replace(EMAIL_PATTERN, "***@***")
    .replace(LONG_DIGITS_PATTERN, "***");
}

function scrubValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (depth > 6 || value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        return JSON.stringify(scrubValue(parsed, depth + 1, seen));
      } catch {
        // Fall through to plain-string redaction
      }
    }
    return redactString(value);
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => scrubValue(item, depth + 1, seen));
    }

    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = "[Filtered]";
      } else {
        sanitized[key] = scrubValue(record[key], depth + 1, seen);
      }
    }
    return sanitized;
  }

  return value;
}

function scrubSentryEvent<T extends Sentry.ErrorEvent>(event: T): T {
  if (event.request) {
    if (event.request.headers) {
      for (const headerName of Object.keys(event.request.headers)) {
        if (
          SENSITIVE_HEADER_PATTERN.test(headerName) ||
          SENSITIVE_KEY_PATTERN.test(headerName)
        ) {
          delete event.request.headers[headerName];
        }
      }
    }

    if ("cookies" in event.request) {
      delete event.request.cookies;
    }

    if (typeof event.request.url === "string") {
      event.request.url = redactString(event.request.url);
    }

    if (typeof event.request.query_string === "string") {
      event.request.query_string = redactString(event.request.query_string);
    } else if (Array.isArray(event.request.query_string)) {
      event.request.query_string = event.request.query_string.map(
        ([k, v]): [string, string] => [
          k,
          SENSITIVE_KEY_PATTERN.test(k) ? "[Filtered]" : redactString(v),
        ],
      );
    } else if (
      event.request.query_string &&
      typeof event.request.query_string === "object"
    ) {
      const qs: Record<string, string> = {};
      for (const [k, v] of Object.entries(event.request.query_string)) {
        qs[k] = SENSITIVE_KEY_PATTERN.test(k) ? "[Filtered]" : redactString(v);
      }
      event.request.query_string = qs;
    }

    if (event.request.data !== undefined) {
      event.request.data = scrubValue(event.request.data);
    }
  }

  if (event.extra) {
    const cleaned = scrubValue(event.extra);
    if (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)) {
      event.extra = cleaned as Record<string, unknown>;
    }
  }

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  return event;
}

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV || "production",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}
