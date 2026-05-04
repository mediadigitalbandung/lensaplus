// Input sanitization utilities
import sanitize from "sanitize-html";

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "strong", "b", "em", "i", "u", "s", "del",
  "a", "img",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "table", "thead", "tbody", "tr", "th", "td",
  "div", "span",
  "figure", "figcaption",
  "iframe", // for YouTube embeds
];

const ALLOWED_ATTR: Record<string, sanitize.AllowedAttribute[]> = {
  a: ["href", "target", "rel", "title"],
  img: ["src", "alt", "title", "width", "height", "class"],
  iframe: ["src", "width", "height", "allowfullscreen", "frameborder", "data-youtube-video"],
  // `style` allowed only on table cells / table itself for text-align, and
  // filtered down to a tiny safe property whitelist via `allowedStyles`.
  // div/span/etc. cannot have `style` — Tailwind via `class` is enough and
  // dropping inline-style there blocks UI-redressing CSS injection.
  div: ["class", "id"],
  span: ["class", "id"],
  td: ["class", "style"],
  th: ["class", "style"],
  table: ["class", "style"],
  "*": ["class", "id"],
};

// A strict subset of CSS properties safe for editor-driven inline `style`
// (e.g. text-align on table cells). `position`, `transform`, `opacity`,
// `z-index`, `clip-path`, etc. are NOT allowed because they can implement
// UI redressing / data exfiltration.
const ALLOWED_STYLES: sanitize.IOptions["allowedStyles"] = {
  "*": {
    "text-align": [/^(left|right|center|justify)$/],
    "color": [/^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))$/i],
    "background-color": [/^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))$/i],
  },
};

export function sanitizeHtml(html: string): string {
  return sanitize(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedStyles: ALLOWED_STYLES,
    allowedIframeHostnames: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com"],
  });
}

// Sanitize plain text input (no HTML allowed)
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, "") // Remove angle brackets
    .trim();
}

// Validate and sanitize email
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// Sanitize slug
export function sanitizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

/**
 * Clean AI text output for short fields (seoTitle, seoDescription, captions).
 * AI providers (Claude, DeepSeek) often wrap responses with Markdown bold,
 * label prefixes ("**SEO Title:**"), or surrounding asterisks/quotes.
 * Strip them so the value is suitable for HTML meta/og:title etc.
 *
 * Examples cleaned:
 *  - "**SEO Title:** RUPST Bank BJB" → "RUPST Bank BJB"
 *  - "**Kinerja Bank BJB Melejit**" → "Kinerja Bank BJB Melejit"
 *  - "**Judul SEO (60 karakter):**\nKrisis Tambak..." → "Krisis Tambak..."
 *  - "\"Berita Bandung\"" → "Berita Bandung"
 *  - "Title: Lorem ipsum" → "Lorem ipsum"
 */
export function cleanAIShortText(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw).trim();

  // Strip wrapping code fences ```...```
  s = s.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");

  // Repeatedly strip leading prefaces / "**Label:**" / "Label:" markers
  // so we land on the actual content.
  for (let i = 0; i < 8; i++) {
    const before = s;
    // Strip "Berikut..." / "Here is..." / "Inilah..." preface up to first colon
    s = s.replace(/^(?:berikut|here is|inilah|ini adalah|silakan|terlampir)[^:\n]{0,80}:\s*\n?/i, "").trim();
    // Markdown bold label with colon: "**SEO Title:**" or "**Judul SEO (60 karakter):**"
    s = s.replace(/^\*\*[^*\n:]{1,80}:\*\*\s*\n?/i, "").trim();
    // Plain label with colon: "SEO Title:" / "Judul SEO:" / "Meta Description:" / "Deskripsi:" / "Title:"
    s = s.replace(/^(?:\*\*)?(?:seo title|judul seo|meta description|description|deskripsi|title|judul|caption|hashtag)[^:\n]{0,40}:(?:\*\*)?\s*\n?/i, "").trim();
    if (s === before) break;
  }

  // Strip first matching "**bold**" wrapper if it's at the start; keep any
  // trailing parenthetical/explanation. Repeats once.
  // Example: "**RUPST BJB Tentuk** (54 chars)" → "RUPST BJB Tentuk (54 chars)"
  for (let i = 0; i < 2; i++) {
    const m = s.match(/^\*\*([^*]+)\*\*(.*)$/s);
    if (!m) break;
    s = (m[1] + m[2]).trim();
  }

  // Final fallback: strip leading/trailing single line of asterisks
  s = s.replace(/^\*+\s*/, "").replace(/\s*\*+$/, "");

  // Strip trailing AI annotation in parentheses:
  //   "(54 karakter)" / "(maks 60 chars)" / "(N words)" / "(60 huruf)"
  // Run twice in case nested.
  for (let i = 0; i < 2; i++) {
    const before = s;
    s = s.replace(/\s*\((?:approx\.?\s*|maks\s*|max\s*|sekitar\s*)?\d{1,3}\s*(?:char(?:acter)?s?|karakter|words?|kata|huruf)\.?\s*\)\s*$/i, "").trim();
    if (s === before) break;
  }

  // Strip wrapping straight or curly quotes
  s = s.replace(/^["'“”‘’]+/, "").replace(/["'“”‘’]+$/, "");

  // Collapse multiple newlines/whitespace into single space (for one-line fields)
  s = s.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();

  return s;
}
