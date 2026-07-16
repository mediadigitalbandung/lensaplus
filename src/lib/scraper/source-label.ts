/**
 * Derive a human-readable PUBLISHER label from a source URL, and rewrite
 * baked-in photo credits inside already-stored article HTML.
 *
 * Why this exists: the scraper used to credit photos with the configured
 * `NewsSource.name`. Several sources were named "Lensaplus", so scraped
 * articles ended up crediting their own site ("Foto: Lensaplus") instead
 * of the website the photo actually came from. We now derive the credit
 * from the upstream article's domain — e.g. https://www.bola.com/... → "Bola",
 * https://bandung.go.id/... → "Bandung" — so the photo source always points
 * at the real origin site regardless of how the source was named.
 */

// Two-label public suffixes we must treat as a single TLD so the brand label
// is the part BEFORE them. Indonesian sites lean heavily on these.
const TWO_LABEL_SUFFIXES = new Set([
  "co.id",
  "go.id",
  "or.id",
  "ac.id",
  "sch.id",
  "web.id",
  "my.id",
  "biz.id",
  "net.id",
  "mil.id",
  "desa.id",
  "ponpes.id",
  "co.uk",
  "com.au",
]);

// Subdomains that are noise, not the brand (mobile/amp/section fronts).
const STRIP_SUBDOMAINS = /^(www|m|amp|mobile)\./;

function titleCase(label: string): string {
  // Capitalise each hyphen-separated part: "pikiran-rakyat" → "Pikiran-Rakyat".
  return label
    .split("-")
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join("-");
}

/**
 * Pull the brand label out of a URL's host.
 *   https://www.bola.com/foo        → "Bola"
 *   https://sport.detik.com/foo      → "Detik"
 *   https://bola.okezone.com/foo     → "Okezone"
 *   https://bandung.go.id/berita     → "Bandung"
 *   https://jabar.tribunnews.com/x   → "Tribunnews"
 * Returns null when the URL is missing/unparseable or looks like a bare IP.
 */
export function sourceLabelFromUrl(
  rawUrl: string | null | undefined,
): string | null {
  if (!rawUrl) return null;
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(STRIP_SUBDOMAINS, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  // Bare IPv4 → no meaningful brand.
  if (parts.every((p) => /^\d+$/.test(p))) return null;

  const lastTwo = parts.slice(-2).join(".");
  const suffixLen = TWO_LABEL_SUFFIXES.has(lastTwo) ? 2 : 1;
  const brandIdx = parts.length - suffixLen - 1;
  if (brandIdx < 0) return null;
  const brand = parts[brandIdx];
  if (!brand) return null;
  return titleCase(brand);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Rewrite the photo-credit text that the scraper baked into stored article
 * HTML, replacing only credits that still say "Lensaplus" with `label`.
 *
 * Targets exactly three credit-bearing shapes, leaving all other content
 * (including legitimate body mentions of "Lensaplus") untouched:
 *   1. scraper figcaptions   <figcaption ...>Foto: Lensaplus</figcaption>
 *   2. rich-text image credit <em>Sumber: Lensaplus</em>
 *   3. attribution footer link Disarikan dari rilis <a ...>Lensaplus — "…"</a>
 *
 * Idempotent: once a credit reads `label` (no longer "Lensaplus") it is no
 * longer matched, so re-running is a no-op.
 */
export function rewriteCreditsInContent(html: string, label: string): string {
  if (!html) return html;
  const esc = escapeHtml(label);
  return (
    html
      // 1. photo credit phrase "Foto: Lensaplus" (scraper figcaptions).
      //    Tag-agnostic so it matches regardless of how the figcaption is
      //    wrapped or whether sanitize stripped its classes.
      .replace(/(\bFoto:\s*)Lensaplus\b/gi, `$1${esc}`)
      // 2. image credit phrase "Sumber: Lensaplus" (rich-text inserts).
      .replace(/(\bSumber:\s*)Lensaplus\b/gi, `$1${esc}`)
      // 3. attribution footer link text: Disarikan dari rilis <a ...>Lensaplus — "…"
      //    Only the link's leading name — never the trailing "Versi Lensaplus" sentence.
      .replace(
        /(Disarikan dari rilis\s*<a\b[^>]*>\s*)Lensaplus(\s*—)/gi,
        `$1${esc}$2`,
      )
  );
}

/** Extract the upstream URL from the "Disarikan dari rilis" footer link, if any. */
export function footerSourceHref(html: string): string | null {
  if (!html) return null;
  const m = html.match(/Disarikan dari rilis\s*<a\b[^>]*\bhref="([^"]+)"/i);
  return m ? m[1] : null;
}

/** Collect distinct local /uploads/... image URLs referenced in article HTML. */
export function uploadUrlsInContent(html: string): string[] {
  if (!html) return [];
  const out = new Set<string>();
  const re = /["'(](\/uploads\/[^"')\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.add(m[1]);
  return Array.from(out);
}
