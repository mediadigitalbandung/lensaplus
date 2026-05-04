import { describe, it, expect } from "vitest";
import {
  sanitizeHtml,
  sanitizeText,
  sanitizeEmail,
  cleanAIShortText,
} from "../sanitize";

describe("sanitizeHtml", () => {
  it("strips <script> tags entirely", () => {
    const out = sanitizeHtml(
      "<p>Hello</p><script>alert('xss')</script><p>World</p>",
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>Hello</p>");
    expect(out).toContain("<p>World</p>");
  });

  it("removes javascript: URIs in href and on* event handlers", () => {
    const out = sanitizeHtml(
      `<a href="javascript:alert(1)" onclick="alert(2)">link</a>`,
    );
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("alert");
  });

  it("preserves allowed tags and attributes (h2, p, blockquote, a, img, table)", () => {
    const html = `
      <h2>Heading</h2>
      <p>Paragraph</p>
      <blockquote>quote</blockquote>
      <a href="https://example.com" title="ex">link</a>
      <img src="/foo.jpg" alt="foo" />
      <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
    `;
    const out = sanitizeHtml(html);
    expect(out).toContain("<h2>Heading</h2>");
    expect(out).toContain("<p>Paragraph</p>");
    expect(out).toContain("<blockquote>");
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('src="/foo.jpg"');
    expect(out).toContain('alt="foo"');
    expect(out).toMatch(/<table[^>]*>/);
    expect(out).toContain("<th>A</th>");
    expect(out).toContain("<td>1</td>");
  });

  it("drops style attribute on div/span (UI redressing protection)", () => {
    const out = sanitizeHtml(
      `<div style="position:fixed;top:0">x</div><span style="display:none">y</span>`,
    );
    expect(out).not.toMatch(/style=/);
    expect(out).toContain("<div>");
    expect(out).toContain("<span>");
  });

  it("allows style='text-align:center' on td/th cells", () => {
    const out = sanitizeHtml(
      `<table><tr><td style="text-align:center">x</td><th style="text-align:right">y</th></tr></table>`,
    );
    expect(out).toMatch(/text-align:\s*center/);
    expect(out).toMatch(/text-align:\s*right/);
  });
});

describe("sanitizeText", () => {
  it("strips angle brackets and trims", () => {
    expect(sanitizeText("  <hello> world  ")).toBe("hello world");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizeText("   ")).toBe("");
  });

  it("preserves inner content while removing brackets", () => {
    expect(sanitizeText("<b>Bold</b>")).toBe("bBold/b");
  });
});

describe("sanitizeEmail", () => {
  it("lowercases and trims", () => {
    expect(sanitizeEmail("  Foo@Example.COM  ")).toBe("foo@example.com");
  });

  it("returns identical string for already-clean lowercase email", () => {
    expect(sanitizeEmail("user@example.com")).toBe("user@example.com");
  });
});

describe("cleanAIShortText", () => {
  it("strips '**SEO Title:**' prefix", () => {
    expect(cleanAIShortText("**SEO Title:** RUPST Bank BJB")).toBe(
      "RUPST Bank BJB",
    );
  });

  it("strips wrapping ** bold markers", () => {
    expect(cleanAIShortText("**Kinerja Bank BJB Melejit**")).toBe(
      "Kinerja Bank BJB Melejit",
    );
  });

  it("removes parenthetical AI annotation '(54 karakter)'", () => {
    expect(cleanAIShortText("RUPST BJB Tentu (54 karakter)")).toBe(
      "RUPST BJB Tentu",
    );
  });

  it("strips wrapping straight and curly quotes", () => {
    expect(cleanAIShortText('"Berita Bandung"')).toBe("Berita Bandung");
    expect(cleanAIShortText("“Berita Bandung”")).toBe("Berita Bandung");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(cleanAIShortText(null)).toBe("");
    expect(cleanAIShortText(undefined)).toBe("");
    expect(cleanAIShortText("")).toBe("");
  });

  it("strips 'Title:' label prefix", () => {
    expect(cleanAIShortText("Title: Lorem ipsum")).toBe("Lorem ipsum");
  });
});
