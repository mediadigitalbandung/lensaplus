/**
 * AI Hallucination Guardrails
 *
 * Fast, regex-based coherence checks that compare an AI-generated article
 * against its source text. Used by the auto-article cron to catch fabricated
 * numbers, names, dates, and quotes before persisting or publishing content.
 *
 * Usage:
 *   import { checkArticle } from "@/lib/ai-guardrail";
 *   const result = checkArticle(generatedText, sourceText);
 *   if (!result.pass) { ... handle warnings ... }
 */

export interface GuardrailWarning {
  type:
    | "fabricated-number"
    | "fabricated-name"
    | "fabricated-date"
    | "fabricated-quote";
  detail: string;
  /** Critical warnings should block save; soft ones allow save with UNVERIFIED flag. */
  critical: boolean;
}

export interface GuardrailResult {
  pass: boolean;
  warnings: GuardrailWarning[];
  /** True if any warning is critical (fabricated-quote). */
  hasCritical: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Extraction helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Extract numeric values from text.
 * Matches:
 *   - "Rp 10 juta" / "Rp10.000" / "Rp 1,5 miliar"
 *   - "5 persen" / "5%"
 *   - "10 tahun" / "2024" (4-digit years)
 *   - plain integers / decimals: "3,5" / "1.200"
 */
function extractNumbers(text: string): string[] {
  const patterns = [
    // Indonesian currency + magnitude
    /Rp\s?[\d.,]+(?:\s?(?:juta|miliar|triliun|ribu))?/gi,
    // Percentages
    /\d+(?:[.,]\d+)?\s?(?:persen|%)/gi,
    // Year-like 4-digit numbers
    /\b(19|20)\d{2}\b/g,
    // Plain numbers with thousand-separators
    /\b\d{1,3}(?:[.,]\d{3})+\b/g,
    // Simple integers ≥ 2 digits (avoids noise from single digit article/preposition)
    /\b\d{2,}\b/g,
  ];

  const found = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.matchAll(new RegExp(pattern.source, pattern.flags));
    for (const m of matches) {
      // Normalize: remove spaces, lowercase magnitude units
      found.add(m[0].replace(/\s+/g, " ").trim().toLowerCase());
    }
  }
  return [...found];
}

/**
 * Extract candidate proper nouns: consecutive capitalized words (≥ 2 words).
 * E.g. "Bank Jabar Banten", "Susi Pudjiastuti".
 * Skips pure numbers. Minimum 2-word sequence.
 */
function extractProperNouns(text: string): string[] {
  // Match sequences of 2+ consecutive title-case words
  const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  const found = new Set<string>();
  const matches = text.matchAll(pattern);
  for (const m of matches) {
    found.add(m[1]);
  }
  return [...found];
}

/**
 * Extract date-like strings in Indonesian:
 *   - "10 Januari 2025", "Maret 2024", "Q1 2025"
 *   - numeric: "10/01/2025", "2025-01-10"
 */
function extractDates(text: string): string[] {
  const MONTHS =
    "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember";
  const patterns = [
    new RegExp(`\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}`, "gi"),
    new RegExp(`(?:${MONTHS})\\s+\\d{4}`, "gi"),
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\bQ[1-4]\s+\d{4}\b/gi,
    // Semester / kuartal
    /\b(?:semester|kuartal|triwulan)\s+[1-4]\s+\d{4}\b/gi,
  ];

  const found = new Set<string>();
  for (const p of patterns) {
    const matches = text.matchAll(new RegExp(p.source, p.flags));
    for (const m of matches) {
      found.add(m[0].toLowerCase().trim());
    }
  }
  return [...found];
}

/**
 * Extract all double-quoted strings from text.
 * Handles both ASCII " and Unicode " " quotes.
 */
function extractQuotes(text: string): string[] {
  const found: string[] = [];
  // ASCII double-quotes
  const asciiMatches = text.matchAll(/"([^"]{10,300})"/g);
  for (const m of asciiMatches) {
    found.push(m[1].trim());
  }
  // Unicode curly quotes
  const curlyMatches = text.matchAll(/“([^”]{10,300})”/g);
  for (const m of curlyMatches) {
    found.push(m[1].trim());
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────
// Presence check
// ─────────────────────────────────────────────────────────────────

/**
 * Normalise a string for comparison: lowercase, collapse whitespace,
 * strip common punctuation.
 */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:!?()\[\]{}'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check whether `candidate` appears in `source` (after normalisation).
 * For numbers, also check the raw numeric value is somewhere in the source.
 */
function presentInSource(candidate: string, source: string): boolean {
  const normCandidate = normalise(candidate);
  const normSource = normalise(source);
  return normSource.includes(normCandidate);
}

/**
 * Quote check is stricter: we look for a substring match of at least the
 * first 20 chars of the quote, to handle minor wording differences.
 */
function quoteAppearsInSource(quote: string, source: string): boolean {
  const normSource = normalise(source);
  const normQuote = normalise(quote);
  // Substring of at least 20 chars (or the whole quote if shorter)
  const probe = normQuote.slice(0, Math.max(20, Math.floor(normQuote.length * 0.6)));
  return normSource.includes(probe);
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────

/**
 * Check a generated article against its source for potential hallucinations.
 *
 * @param generated - Plain text (or HTML stripped) of the AI-generated article.
 * @param source    - Plain text of the original source article used for generation.
 * @returns GuardrailResult with pass=true if no warnings, or warnings list.
 */
export function checkArticle(generated: string, source: string): GuardrailResult {
  const warnings: GuardrailWarning[] = [];

  // ── 1. Number coherence ──────────────────────────────────────
  const genNumbers = extractNumbers(generated);
  for (const num of genNumbers) {
    if (!presentInSource(num, source)) {
      warnings.push({
        type: "fabricated-number",
        detail: `Angka "${num}" di teks generated tidak ditemukan di sumber.`,
        critical: false,
      });
    }
  }

  // ── 2. Proper noun coherence ─────────────────────────────────
  const genNames = extractProperNouns(generated);
  for (const name of genNames) {
    // Skip very common generic proper nouns that appear in boilerplate
    if (["Indonesia", "Bandung", "Jakarta", "Kartawarta"].includes(name)) continue;
    if (!presentInSource(name, source)) {
      warnings.push({
        type: "fabricated-name",
        detail: `Nama "${name}" di teks generated tidak ditemukan di sumber.`,
        critical: false,
      });
    }
  }

  // ── 3. Date coherence ───────────────────────────────────────
  const genDates = extractDates(generated);
  for (const date of genDates) {
    if (!presentInSource(date, source)) {
      warnings.push({
        type: "fabricated-date",
        detail: `Tanggal/periode "${date}" di teks generated tidak ditemukan di sumber.`,
        critical: false,
      });
    }
  }

  // ── 4. Quote check (CRITICAL) ────────────────────────────────
  const genQuotes = extractQuotes(generated);
  for (const quote of genQuotes) {
    if (!quoteAppearsInSource(quote, source)) {
      warnings.push({
        type: "fabricated-quote",
        detail: `Kutipan langsung "${quote.slice(0, 80)}${quote.length > 80 ? "..." : ""}" tidak ditemukan di sumber.`,
        critical: true,
      });
    }
  }

  const hasCritical = warnings.some((w) => w.critical);

  return {
    pass: warnings.length === 0,
    warnings,
    hasCritical,
  };
}
