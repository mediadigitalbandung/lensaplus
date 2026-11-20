import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCallAI = vi.fn();
vi.mock("@/lib/ai-client", () => ({
  callAI: (...a: unknown[]) => mockCallAI(...a),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    socialMediaSettings: {
      findUnique: vi.fn(async () => ({
        captionTemplate: "Judul: {{title}}\n\n{{summary}}\n\n{{link}}",
      })),
    },
  },
}));

vi.mock("sharp", () => ({
  default: vi.fn(),
}));

vi.mock("./download-image", () => ({
  downloadImageToUploads: vi.fn(),
}));

import { parsePositiveInt, toLocalDatetimeInputValue } from "../utils";
import { escapeHtml } from "../sanitize";
import { isSafeHttpUrl } from "../safe-path";
import { computeCostUsd } from "../ai-pricing";
import { injectImagesIntoBody } from "../scraper/paraphrase";
import { wrapText, resolvePlaceholders } from "../social/template-renderer";
import { generateSocialCaption } from "../social/caption-generator";
import type { ArticleForPublish } from "../social/types";

describe("Batch 2 critical fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parsePositiveInt", () => {
    it("guards against NaN, empty, negative, zero, and enforces upper bound", () => {
      expect(parsePositiveInt(null, 12)).toBe(12);
      expect(parsePositiveInt(undefined, 20)).toBe(20);
      expect(parsePositiveInt("abc", 1)).toBe(1);
      expect(parsePositiveInt("0", 12)).toBe(12);
      expect(parsePositiveInt("-5", 12)).toBe(12);
      expect(parsePositiveInt("25", 12, 100)).toBe(25);
      expect(parsePositiveInt("9999", 12, 100)).toBe(100);
    });
  });

  describe("toLocalDatetimeInputValue", () => {
    it("round-trips ISO timestamp through local datetime-local format without timezone shift", () => {
      const original = new Date("2026-11-17T07:35:00.000Z");
      const localInput = toLocalDatetimeInputValue(original);
      expect(localInput).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      const roundTripped = new Date(localInput);
      expect(roundTripped.getTime()).toBe(original.getTime());
    });
  });

  describe("escapeHtml & isSafeHttpUrl", () => {
    it("escapes HTML metacharacters", () => {
      expect(escapeHtml(`<script>"a"&'b'</script>`)).toBe(
        "&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/script&gt;",
      );
      expect(escapeHtml(null)).toBe("");
    });

    it("allows only valid http/https URLs and rejects dangerous schemes", () => {
      expect(isSafeHttpUrl("https://lensaplus.com/berita/test")).toBe(true);
      expect(isSafeHttpUrl("http://example.com")).toBe(true);
      expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
      expect(isSafeHttpUrl("data:text/html,<script>1</script>")).toBe(false);
      expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
      expect(isSafeHttpUrl("/uploads/img.jpg")).toBe(false);
      expect(isSafeHttpUrl("")).toBe(false);
    });
  });

  describe("computeCostUsd dated Anthropic model support", () => {
    it("resolves dated Anthropic model IDs via prefix/date stripping", () => {
      const base = computeCostUsd({
        provider: "anthropic",
        model: "claude-haiku-4-5",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      });
      const dated = computeCostUsd({
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      });
      expect(base).toBe(6);
      expect(dated).toBe(base);

      const sonnetDated = computeCostUsd({
        provider: "anthropic",
        model: "claude-sonnet-4-6-20260217",
        inputTokens: 1_000_000,
        outputTokens: 0,
      });
      expect(sonnetDated).toBe(3);
    });
  });

  describe("injectImagesIntoBody", () => {
    it("inserts image #0 once after paragraph 1 and distributes remaining images without duplication", () => {
      const body = "<p>P1</p><p>P2</p><p>P3</p><p>P4</p><p>P5</p>";
      const imgs = [
        "https://img.example.com/0.jpg",
        "https://img.example.com/1.jpg",
        "https://img.example.com/2.jpg",
      ];
      const out = injectImagesIntoBody(body, imgs, "Alt", "Sumber");

      for (const u of imgs) {
        const matches = out.split(u).length - 1;
        expect(matches).toBe(1);
      }
      expect(out.indexOf("0.jpg")).toBeLessThan(out.indexOf("<p>P2</p>"));
      expect(out.indexOf("1.jpg")).toBeGreaterThan(out.indexOf("<p>P2</p>"));
      expect(out.indexOf("2.jpg")).toBeGreaterThan(out.indexOf("1.jpg"));
    });

    it("handles single-paragraph articles without dropping extra images", () => {
      const out = injectImagesIntoBody(
        "<p>Lead</p>",
        ["https://img.example.com/a.jpg", "https://img.example.com/b.jpg"],
        "Alt",
      );
      expect(out).toContain("a.jpg");
      expect(out).toContain("b.jpg");
    });
  });

  describe("template-renderer wrapText and resolvePlaceholders", () => {
    it("breaks ultra-narrow widths without entering an infinite loop", () => {
      const lines = wrapText("SUPERLONGWORD", 1, 24, 20, "Inter", "bold");
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.join("")).toBe("SUPERLONGWORD");
    });

    it("resolves paraphrased_title separately from raw title and preserves '$' literals", () => {
      const article: ArticleForPublish = {
        id: "a1",
        title: "Harga BBM Naik $10 $& Test",
        slug: "bbm",
        content: "<p>Isi</p>",
        excerpt: "Ringkas $99",
        featuredImage: null,
        publishedAt: new Date("2026-06-01T00:00:00Z"),
        publishToInstagram: true,
        publishToFacebook: false,
        publishToTwitter: false,
        publishToThreads: null,
        categoryId: "c1",
        tags: [],
        author: { id: "u1", name: "Redaksi", avatar: null },
        category: { id: "c1", name: "Ekonomi", slug: "ekonomi" },
      };

      const rendered = resolvePlaceholders(
        "{{paraphrased_title}} | {{title}} | {{summary}}",
        article,
        { paraphrasedTitle: "Versi Parafrase $5", shortSummary: "Singkat $1" },
      );
      expect(rendered).toBe(
        "Versi Parafrase $5 | Harga BBM Naik $10 $& Test | Singkat $1",
      );
    });
  });

  describe("caption-generator '$' safety", () => {
    it("preserves literal '$', '$&', '$1' in article title and AI body", async () => {
      global.fetch = vi.fn(async () => new Response("[]", { status: 200 })) as unknown as typeof fetch;
      mockCallAI.mockResolvedValue({
        text: "CAPTION:\nNilai kontrak capai $100 juta dan $& bonus.\nHASHTAGS:\nekonomi",
      });
      const caption = await generateSocialCaption({
        article: {
          id: "a2",
          title: "Investasi $50 $1 di Bandung",
          slug: "investasi-bandung",
          content: "<p>Isi</p>",
          excerpt: "Ringkasan",
          featuredImage: null,
          publishedAt: new Date("2026-06-01T00:00:00Z"),
          publishToInstagram: true,
          publishToFacebook: false,
          publishToTwitter: false,
          publishToThreads: null,
          categoryId: "c2",
          tags: [],
          author: { id: "u1", name: "Redaksi", avatar: null },
          category: { id: "c2", name: "Bisnis", slug: "bisnis" },
        },
        platform: "INSTAGRAM",
      });
      expect(caption).toContain("Investasi $50 $1 di Bandung");
      expect(caption).toContain("Nilai kontrak capai $100 juta dan $& bonus.");
    });
  });
});
