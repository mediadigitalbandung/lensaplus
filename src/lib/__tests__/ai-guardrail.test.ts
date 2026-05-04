import { describe, it, expect } from "vitest";
import { checkArticle } from "../ai-guardrail";

// ─────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────

const SOURCE_BASE = `
Bank BJB mencatatkan laba bersih sebesar Rp 1,2 triliun pada kuartal 1 2025,
naik 15 persen dibandingkan periode yang sama tahun lalu.
Direktur Utama Yuddy Renaldi menyampaikan bahwa target pertumbuhan kredit 12 persen
akan tercapai pada akhir 2025.
Rapat Umum Pemegang Saham Tahunan (RUPST) dijadwalkan pada 25 Maret 2025 di Bandung.
Yuddy Renaldi menyatakan: "Kami optimis dapat melampaui target yang telah ditetapkan."
`;

// ─────────────────────────────────────────────────────────────────
// Test cases
// ─────────────────────────────────────────────────────────────────

describe("checkArticle — AI hallucination guardrails", () => {
  /**
   * Test 1: Clean paraphrase — all facts from source, no fabrications.
   * Expected: pass=true, no warnings.
   */
  it("Test 1: faithful paraphrase passes with no warnings", () => {
    const generated = `
      Bank BJB meraup laba bersih Rp 1,2 triliun di kuartal 1 2025, meningkat 15 persen
      year-on-year. Yuddy Renaldi selaku Direktur Utama menargetkan pertumbuhan kredit
      sebesar 12 persen hingga akhir 2025. RUPST akan digelar 25 Maret 2025.
    `;
    const result = checkArticle(generated, SOURCE_BASE);
    expect(result.pass).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.hasCritical).toBe(false);
  });

  /**
   * Test 2: Fabricated number — AI invents Rp 2 triliun that is not in source.
   * Expected: fabricated-number warning, pass=false.
   */
  it("Test 2: fabricated number triggers warning", () => {
    const generated = `
      Bank BJB meraup laba bersih Rp 2 triliun pada kuartal 1 2025.
      Yuddy Renaldi menargetkan pertumbuhan kredit 12 persen.
    `;
    const result = checkArticle(generated, SOURCE_BASE);
    expect(result.pass).toBe(false);
    const numWarn = result.warnings.filter((w) => w.type === "fabricated-number");
    expect(numWarn.length).toBeGreaterThan(0);
    expect(numWarn[0].critical).toBe(false);
    expect(result.hasCritical).toBe(false);
  });

  /**
   * Test 3: Fabricated person name — AI invents "Deni Suherman" not in source.
   * Expected: fabricated-name warning.
   */
  it("Test 3: fabricated person name triggers warning", () => {
    const generated = `
      Deni Suherman, Komisaris Bank BJB, menyatakan laba 2025 mencapai Rp 1,2 triliun.
      Target kredit 12 persen disampaikan Yuddy Renaldi.
    `;
    const result = checkArticle(generated, SOURCE_BASE);
    expect(result.pass).toBe(false);
    const nameWarn = result.warnings.filter((w) => w.type === "fabricated-name");
    expect(nameWarn.length).toBeGreaterThan(0);
    // "Deni Suherman" or "Deni Suherman" should be flagged
    expect(nameWarn.some((w) => w.detail.includes("Deni Suherman"))).toBe(true);
  });

  /**
   * Test 4: Fabricated direct quote — AI invents a quote not in source.
   * Expected: fabricated-quote warning, critical=true, hasCritical=true.
   */
  it("Test 4: fabricated direct quote is critical warning", () => {
    const generated = `
      Bank BJB melaporkan pertumbuhan signifikan. Yuddy Renaldi menyatakan:
      "Kami akan membuka 50 cabang baru di seluruh Jawa Barat pada 2026."
    `;
    const result = checkArticle(generated, SOURCE_BASE);
    expect(result.pass).toBe(false);
    expect(result.hasCritical).toBe(true);
    const quoteWarn = result.warnings.filter((w) => w.type === "fabricated-quote");
    expect(quoteWarn.length).toBeGreaterThan(0);
    expect(quoteWarn[0].critical).toBe(true);
  });

  /**
   * Test 5: Multiple violation types — fabricated date + fabricated name.
   * Expected: multiple warnings, none critical (no fabricated quote).
   */
  it("Test 5: multiple soft warnings accumulate correctly", () => {
    const generated = `
      Bank BJB mengadakan RUPST pada 10 April 2025 di Gedung Sate.
      Presiden Direktur Budi Santoso menyatakan laba naik 15 persen.
      Kredit tumbuh Rp 1,2 triliun kuartal 1 2025.
    `;
    const result = checkArticle(generated, SOURCE_BASE);
    // "10 April 2025" is not in source (source has 25 Maret 2025)
    // "Budi Santoso" is not in source
    const dateWarn = result.warnings.filter((w) => w.type === "fabricated-date");
    const nameWarn = result.warnings.filter((w) => w.type === "fabricated-name");
    expect(dateWarn.length + nameWarn.length).toBeGreaterThan(0);
    expect(result.hasCritical).toBe(false);
    expect(result.pass).toBe(false);
  });

  /**
   * Test 6: Real quote from source passes without fabricated-quote warning.
   */
  it("Test 6: quote present in source does not trigger fabricated-quote", () => {
    const generated = `
      Direktur Utama Bank BJB Yuddy Renaldi mengungkapkan:
      "Kami optimis dapat melampaui target yang telah ditetapkan."
      Laba naik 15 persen di kuartal 1 2025.
    `;
    const result = checkArticle(generated, SOURCE_BASE);
    const quoteWarn = result.warnings.filter((w) => w.type === "fabricated-quote");
    expect(quoteWarn).toHaveLength(0);
    expect(result.hasCritical).toBe(false);
  });

  /**
   * Test 7: Empty generated text has no warnings.
   */
  it("Test 7: empty generated text passes trivially", () => {
    const result = checkArticle("", SOURCE_BASE);
    expect(result.pass).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
