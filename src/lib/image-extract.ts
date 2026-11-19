import { isSafeImageRef } from "./safe-path";

/**
 * Extract the first safe <img src="..."> URL from an HTML string.
 * Validates each candidate strictly with `isSafeImageRef()` (blocking
 * `javascript:`, case-insensitive `data:`, `file:`, protocol-relative `//`,
 * path traversal, and control characters) and skips invalid/empty refs.
 */
export function extractFirstImageUrl(html: string | null | undefined): string | null {
  if (!html) return null;
  const imgSrcRegex = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  for (const match of html.matchAll(imgSrcRegex)) {
    const raw = (match[1] ?? match[2] ?? "").trim();
    if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) continue;
    if (!isSafeImageRef(raw)) continue;
    return raw;
  }
  return null;
}
