/**
 * Sorotan content formatting & sanitization helpers.
 *
 * Canonical format for `Sorotan.content` is clean, structured editorial HTML
 * using a strict subset of semantic typography tags (`<p>`, `<h2>`, `<h3>`,
 * `<blockquote>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<br>`),
 * matching Lensaplus `.article-content` typography and `docs/DESIGN_SOP.md`.
 *
 * Both the save pipeline (`sorotan-generator.ts`) and public renderers
 * (`/sorotan` & `/sorotan/[slug]`) route through these helpers so:
 *  - Existing production rows (HTML, plain-text paragraphs, mixed text+HTML,
 *    HTML entities, or truncated trailing tags) render cleanly immediately.
 *  - Newly generated rows are stored consistently and safely.
 *  - Literal tags (`<p>`, `<h1>`, `<h2>`, `&lt;p&gt;`, `</p`, etc.) never leak
 *    to readers, meta descriptions, or JSON-LD excerpts.
 *  - All HTML output is strictly XSS-sanitized with zero inline attributes.
 */

import sanitize from "sanitize-html";

const SOROTAN_ALLOWED_TAGS = [
  "h2",
  "h3",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "ul",
  "ol",
  "li",
  "blockquote",
];

const SOROTAN_NON_TEXT_TAGS = [
  "style",
  "script",
  "textarea",
  "option",
  "noscript",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "head",
  "title",
];

const SANITIZE_SOROTAN_OPTIONS: sanitize.IOptions = {
  allowedTags: SOROTAN_ALLOWED_TAGS,
  allowedAttributes: {},
  disallowedTagsMode: "discard",
  nonTextTags: SOROTAN_NON_TEXT_TAGS,
  transformTags: {
    // Page title already uses <h1>, so body headings start at <h2>.
    h1: "h2",
    h4: "h3",
    h5: "h3",
    h6: "h3",
    b: "strong",
    i: "em",
  },
  exclusiveFilter: (frame) => {
    if (
      frame.tag === "p" ||
      frame.tag === "h2" ||
      frame.tag === "h3" ||
      frame.tag === "blockquote" ||
      frame.tag === "li" ||
      frame.tag === "ul" ||
      frame.tag === "ol"
    ) {
      const text = frame.text.replace(/\u00a0/g, " ").trim();
      return text.length === 0;
    }
    return false;
  },
};

const KNOWN_ESCAPED_TAG_RE =
  /&lt;(\/?(?:h[1-6]|p|br|hr|ul|ol|li|blockquote|strong|b|em|i|u|div|span|section|article|main|header|footer|a|img|script|style|iframe|svg|object|embed|head|title|html|body)(?:\s[^<>\n]{0,300})?\s*\/?)&gt;/gi;

const DOUBLE_ESCAPED_TAG_RE =
  /&amp;lt;\/?(?:h[1-6]|p|br|hr|ul|ol|li|blockquote|strong|b|em|i|u|div|span|section|article|a|img|script|style|iframe)\b/i;

const BLOCK_HTML_LINE_START_RE =
  /^\s*<(?:p|h[1-6]|ul|ol|li|blockquote)\b/i;

const CONTAINER_OPEN_RE = /<(ul|ol|blockquote)\b[^>]*>/gi;
const CONTAINER_CLOSE_RE = /<\/(ul|ol|blockquote)\s*>/gi;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

function decodeHtmlEntitiesOnce(input: string): string {
  return input.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi,
    (match, dec: string | undefined, hex: string | undefined, named: string | undefined) => {
      if (dec) {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      if (hex) {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      if (named) {
        const mapped = NAMED_ENTITIES[named.toLowerCase()];
        return mapped !== undefined ? mapped : match;
      }
      return match;
    },
  );
}

/**
 * Strip wrapping markdown code fences such as ```html ... ```.
 */
function stripCodeFences(input: string): string {
  return input
    .replace(/^```[a-z0-9_-]*\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

/**
 * Unescape entity-encoded HTML tags (including double-escaped `&amp;lt;p&amp;gt;`)
 * while leaving legitimate prose comparisons like `inflasi &lt; 3%` untouched.
 */
function unescapeEncodedHtmlTags(input: string): string {
  let s = input;

  for (let pass = 0; pass < 2; pass++) {
    if (DOUBLE_ESCAPED_TAG_RE.test(s)) {
      s = s
        .replace(/&amp;lt;/gi, "&lt;")
        .replace(/&amp;gt;/gi, "&gt;")
        .replace(/&amp;quot;/gi, "&quot;")
        .replace(/&amp;amp;/gi, "&amp;");
    }

    const before = s;
    s = s.replace(KNOWN_ESCAPED_TAG_RE, (_m, inner: string) => {
      const decodedInner = inner
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&amp;/gi, "&");
      return `<${decodedInner}>`;
    });

    // Also strip truncated escaped trailing tags such as `&lt;/p` or `&lt;/`
    s = s.replace(/&lt;\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^<>\n]*)?$/, "");
    s = s.replace(/&lt;\/?$/, "");

    if (s === before) break;
  }

  return s;
}

/**
 * Remove incomplete/truncated HTML tags left at the tail of an AI response
 * (e.g. `...semua pihak.</` or `...di bawah Calafat.</p`).
 */
function stripTruncatedTrailingTags(input: string): string {
  return input
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?$/, "")
    .replace(/<\/?$/, "")
    .trim();
}

/**
 * Convert common inline Markdown syntax (`**bold**`, `*italic*`, `` `code` ``,
 * `[label](url)`) outside HTML tags into clean editorial HTML.
 */
function formatInlineMarkdownOutsideTags(input: string): string {
  const parts = input.split(/(<[^>]+>)/g);
  return parts
    .map((part) => {
      if (!part || part.startsWith("<")) return part;
      let text = part;
      // Markdown links: keep clean visible label only (avoid unverified AI URLs).
      text = text.replace(/\[([^\]\n]+)\]\((?:https?:\/\/|\/)[^)\s]+\)/g, "$1");
      // Inline code backticks -> plain text
      text = text.replace(/`([^`\n]+)`/g, "$1");
      // Bold **text**
      text = text.replace(/\*\*([^\s*](?:[^*\n]*?[^\s*])?)\*\*/g, "<strong>$1</strong>");
      // Italic *text* with conservative boundary checks so math like 2*3*4 is untouched
      text = text.replace(
        /(^|[\s([{"'“‘—–-])\*([^\s*](?:[^*\n]*?[^\s*])?)\*(?=$|[\s.,;:!?)\]}"'”’—–-])/g,
        "$1<em>$2</em>",
      );
      return text;
    })
    .join("");
}

/**
 * Normalize block wrappers and ensure block-level HTML tags sit on clean line
 * boundaries so mixed HTML + plain text / Markdown parses deterministically.
 */
function preprocessHtmlBoundaries(input: string): string {
  let s = input;

  // Remove DOCTYPE declarations and full-document wrappers while keeping inner body.
  s = s.replace(/<!DOCTYPE[^>]*>/gi, "");
  // Remove dangerous non-text containers early so their internals never leak as bare text.
  s = s.replace(
    /<(script|style|head|title|iframe|object|embed|svg|math|noscript|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    "\n",
  );
  // Treat layout wrapper tags as block boundaries so `<div>A</div><div>B</div>`
  // becomes separate paragraphs instead of merged text.
  s = s.replace(/<\/?(?:html|body|main|header|footer|section|article|div)\b[^>]*>/gi, "\n\n");
  // Convert `<hr>` to blank-line separator.
  s = s.replace(/<hr\b[^>]*\/?>/gi, "\n\n");
  // Split double `<br><br>` inside paragraphs into separate paragraphs.
  s = s.replace(/(?:<br\s*\/?>\s*){2,}/gi, "</p>\n\n<p>");

  // Collapse stray line breaks inside closed `<p>` and `<h1..6>` elements so
  // multi-line headings/paragraphs are never split into two separate blocks.
  s = s.replace(
    /<(h[1-6]|p)(\b[^>]*)>([\s\S]*?)<\/\1\s*>/gi,
    (full, tag: string, attrs: string, inner: string) => {
      if (/<\/?(?:p|h[1-6]|ul|ol|li|blockquote|div)\b/i.test(inner)) {
        return full;
      }
      return `<${tag}${attrs}>${inner.replace(/\s*\n\s*/g, " ").trim()}</${tag}>`;
    },
  );

  // Place closing and opening block tags on separate lines so inline sequences like
  // `<h2>Judul</h2>Teks lupa tag p` or `</p><p>` split cleanly.
  s = s.replace(/(<\/(?:p|h[1-6]|ul|ol|blockquote)\s*>)(?=\s*\S)/gi, "$1\n");
  s = s.replace(/([^\n])(<(?:p|h[1-6]|ul|ol|blockquote)\b[^>]*>)/gi, "$1\n$2");

  return s;
}

function hasClosingTagAhead(lines: string[], startIdx: number, tag: string): boolean {
  const closeRe = new RegExp(`</${tag}\\s*>`, "i");
  for (let i = startIdx; i < lines.length; i++) {
    if (closeRe.test(lines[i])) return true;
  }
  return false;
}

/**
 * Parse normalized lines (HTML blocks, plain-text paragraphs, Markdown blocks,
 * or any mix thereof) into structured block HTML.
 */
function normalizeBlocksToHtml(input: string): string {
  const preprocessed = preprocessHtmlBoundaries(input);
  const rawLines = preprocessed.split("\n");
  const hasBlankLineSeparators = /\n\s*\n/.test(preprocessed);

  const outputBlocks: string[] = [];

  let paragraphLines: string[] = [];
  let mdUnorderedItems: string[] = [];
  let mdOrderedItems: string[] = [];
  let mdQuoteLines: string[] = [];
  let orphanHtmlLiItems: string[] = [];

  // Container HTML block tracking (`ul`, `ol`, `blockquote`)
  const containerStack: string[] = [];
  let htmlContainerLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const joined = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    if (joined) {
      outputBlocks.push(`<p>${formatInlineMarkdownOutsideTags(joined)}</p>`);
    }
    paragraphLines = [];
  };

  const flushMdUnordered = () => {
    if (mdUnorderedItems.length === 0) return;
    outputBlocks.push(
      `<ul>${mdUnorderedItems.map((item) => `<li>${formatInlineMarkdownOutsideTags(item)}</li>`).join("")}</ul>`,
    );
    mdUnorderedItems = [];
  };

  const flushMdOrdered = () => {
    if (mdOrderedItems.length === 0) return;
    outputBlocks.push(
      `<ol>${mdOrderedItems.map((item) => `<li>${formatInlineMarkdownOutsideTags(item)}</li>`).join("")}</ol>`,
    );
    mdOrderedItems = [];
  };

  const flushMdQuote = () => {
    if (mdQuoteLines.length === 0) return;
    const joined = mdQuoteLines.join(" ").replace(/\s+/g, " ").trim();
    if (joined) {
      outputBlocks.push(`<blockquote><p>${formatInlineMarkdownOutsideTags(joined)}</p></blockquote>`);
    }
    mdQuoteLines = [];
  };

  const flushOrphanHtmlLi = () => {
    if (orphanHtmlLiItems.length === 0) return;
    outputBlocks.push(`<ul>${orphanHtmlLiItems.join("")}</ul>`);
    orphanHtmlLiItems = [];
  };

  const flushTextBuffers = () => {
    flushParagraph();
    flushMdUnordered();
    flushMdOrdered();
    flushMdQuote();
    flushOrphanHtmlLi();
  };

  const flushHtmlContainer = () => {
    if (htmlContainerLines.length === 0) return;
    const joined = htmlContainerLines.join("\n").trim();
    if (joined) {
      outputBlocks.push(formatInlineMarkdownOutsideTags(joined));
    }
    htmlContainerLines = [];
  };

  const updateContainerStack = (line: string, lineIdx: number) => {
    CONTAINER_OPEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CONTAINER_OPEN_RE.exec(line)) !== null) {
      const tag = m[1].toLowerCase();
      if (hasClosingTagAhead(rawLines, lineIdx, tag)) {
        containerStack.push(tag);
      }
    }
    CONTAINER_CLOSE_RE.lastIndex = 0;
    while ((m = CONTAINER_CLOSE_RE.exec(line)) !== null) {
      const tag = m[1].toLowerCase();
      const idx = containerStack.lastIndexOf(tag);
      if (idx !== -1) {
        containerStack.splice(idx, 1);
      }
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    // Currently accumulating an open multi-line HTML container (<ul>, <ol>, <blockquote>)
    if (containerStack.length > 0) {
      htmlContainerLines.push(rawLine);
      updateContainerStack(rawLine, i);
      if (containerStack.length === 0) {
        flushHtmlContainer();
      }
      continue;
    }

    // Blank line terminates open text/markdown blocks
    if (!trimmed) {
      flushTextBuffers();
      continue;
    }

    // Stray HTML closing tag on its own line (e.g. leftover `</p>` or `</ul>`)
    if (/^<\/[a-zA-Z0-9]+\s*>$/.test(trimmed)) {
      flushTextBuffers();
      continue;
    }

    // Block-level HTML line (`<p>`, `<h1>`..`<h6>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>`)
    if (BLOCK_HTML_LINE_START_RE.test(trimmed)) {
      // Orphan `<li>` outside `<ul>`/`<ol>` -> wrap consecutive `<li>` into `<ul>`
      if (/^<li\b/i.test(trimmed)) {
        flushParagraph();
        flushMdUnordered();
        flushMdOrdered();
        flushMdQuote();
        orphanHtmlLiItems.push(formatInlineMarkdownOutsideTags(trimmed));
        continue;
      }

      flushTextBuffers();
      updateContainerStack(trimmed, i);
      if (containerStack.length > 0) {
        htmlContainerLines.push(rawLine);
      } else {
        outputBlocks.push(formatInlineMarkdownOutsideTags(trimmed));
      }
      continue;
    }

    // Horizontal rule line in Markdown (`---`, `***`, `___`)
    if (/^(?:---+|\*\*\*+|___+)$/.test(trimmed)) {
      flushTextBuffers();
      continue;
    }

    // Markdown ATX Heading (`#`..`######`)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
    if (headingMatch) {
      flushTextBuffers();
      const level = headingMatch[1].length;
      const tag = level <= 2 ? "h2" : "h3";
      const headingText = formatInlineMarkdownOutsideTags(headingMatch[2].trim());
      if (headingText) {
        outputBlocks.push(`<${tag}>${headingText}</${tag}>`);
      }
      continue;
    }

    // Markdown unordered list (`- item`, `* item`, `• item`)
    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      flushMdOrdered();
      flushMdQuote();
      flushOrphanHtmlLi();
      mdUnorderedItems.push(ulMatch[1].trim());
      continue;
    }

    // Markdown ordered list (`1. item`, `1) item`)
    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      flushMdUnordered();
      flushMdQuote();
      flushOrphanHtmlLi();
      mdOrderedItems.push(olMatch[1].trim());
      continue;
    }

    // Markdown blockquote (`> quote`)
    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushMdUnordered();
      flushMdOrdered();
      flushOrphanHtmlLi();
      if (quoteMatch[1].trim()) {
        mdQuoteLines.push(quoteMatch[1].trim());
      }
      continue;
    }

    // Regular plain text line
    flushMdUnordered();
    flushMdOrdered();
    flushMdQuote();
    flushOrphanHtmlLi();

    if (hasBlankLineSeparators) {
      paragraphLines.push(trimmed);
    } else {
      // No blank lines anywhere in input: treat each non-empty line as its own paragraph
      outputBlocks.push(`<p>${formatInlineMarkdownOutsideTags(trimmed)}</p>`);
    }
  }

  flushHtmlContainer();
  flushTextBuffers();

  return outputBlocks.join("\n");
}

/**
 * Format and strictly sanitize Sorotan body content into canonical editorial HTML.
 *
 * Handles:
 *  - Existing HTML (`<p>`, `<h1>`..`<h6>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>`, `<strong>`, `<em>`)
 *  - Legacy plain-text paragraphs (`\n\n` or single `\n`)
 *  - Mixed bare-text paragraphs + HTML blocks
 *  - Single- and double-escaped HTML (`&lt;p&gt;`, `&amp;lt;h2&amp;gt;`)
 *  - Truncated trailing HTML tags (`</`, `</p`, `<h2`)
 *  - Markdown headings, bold/italic, lists, quotes, code fences
 *  - XSS payloads (`<script>`, `onerror`, `javascript:`, `<iframe>`, inline `style`/`class`)
 *
 * Output is guaranteed idempotent: `formatSorotanHtml(formatSorotanHtml(x)) === formatSorotanHtml(x)`.
 */
export function formatSorotanHtml(raw: string | null | undefined): string {
  if (!raw) return "";

  let s = String(raw).replace(/\r\n?/g, "\n").trim();
  if (!s) return "";

  s = stripCodeFences(s);
  s = unescapeEncodedHtmlTags(s);
  s = stripTruncatedTrailingTags(s);
  if (!s) return "";

  const normalizedHtml = normalizeBlocksToHtml(s);
  const sanitized = sanitize(normalizedHtml, SANITIZE_SOROTAN_OPTIONS);

  // Normalize inter-block spacing cleanly and collapse redundant blank lines.
  return sanitized
    .replace(/>\s*\n+\s*</g, ">\n<")
    .replace(/<blockquote>\n<p>/g, "<blockquote><p>")
    .replace(/<\/p>\n<\/blockquote>/g, "</p></blockquote>")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Extract clean, human-readable plain text from Sorotan content for cards,
 * `<meta name="description">`, OpenGraph/Twitter descriptions, JSON-LD excerpts,
 * and minimum content length checks.
 *
 * Never emits literal HTML tags, broken tag fragments, Markdown markers, or
 * undecoded HTML entities (`&amp;`, `&nbsp;`, `&quot;`, etc.).
 */
export function sorotanToPlainText(
  raw: string | null | undefined,
  maxLength?: number,
): string {
  if (!raw) return "";

  const html = formatSorotanHtml(raw);
  if (!html) return "";

  const text = decodeHtmlEntitiesOnce(
    html
      // Block boundaries and <br> become spaces so adjacent blocks never fuse together
      .replace(/<\/?(?:p|h[1-6]|ul|ol|li|blockquote|br|div|section|article|hr)\b[^>]*>/gi, " ")
      // Inline tags (`<strong>`, `<em>`) vanish without injecting spaces before punctuation
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (typeof maxLength === "number" && maxLength > 0 && text.length > maxLength) {
    const sliced = text.slice(0, maxLength);
    const lastSpace = sliced.lastIndexOf(" ");
    const cutoff =
      lastSpace >= Math.floor(maxLength * 0.7) ? sliced.slice(0, lastSpace) : sliced;
    return `${cutoff.replace(/[\s,.;:!?-]+$/, "").trimEnd()}…`;
  }

  return text;
}

/**
 * Clean a Sorotan title into single-line plain text without stray HTML tags or
 * raw HTML entities.
 */
export function cleanSorotanTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  return sorotanToPlainText(raw);
}
