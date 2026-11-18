/**
 * Validate external/DB-backed URLs before binding to `<a href>`.
 * Allows only `http:` and `https:` URLs by default; optionally allows
 * single-slash local relative paths (`/uploads/...`) when `allowRelative` is true.
 * Rejects `javascript:`, `data:`, `vbscript:`, `file:`, protocol-relative `//`,
 * control characters, and malformed URLs.
 */
export function safeHref(
  raw: string | null | undefined,
  options?: { allowRelative?: boolean },
): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return null;

  if (options?.allowRelative && trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    // Reject invalid URLs and unknown schemes
  }
  return null;
}
