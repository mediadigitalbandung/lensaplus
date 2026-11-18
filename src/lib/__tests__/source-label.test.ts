import { describe, it, expect } from "vitest";

import {
  sourceLabelFromUrl,
  sourceWebsiteFromUrl,
  formatSourceWithWebsite,
  rewriteCreditsInContent,
  footerSourceHref,
  stripAttributionFooter,
  uploadUrlsInContent,
} from "../scraper/source-label";

describe("sourceLabelFromUrl", () => {
  it("strips www and derives the brand", () => {
    expect(sourceLabelFromUrl("https://www.bola.com/foo/bar")).toBe("Bola");
    expect(sourceLabelFromUrl("https://www.detik.com/x")).toBe("Detik");
    expect(sourceLabelFromUrl("https://www.antaranews.com/y")).toBe(
      "Antaranews",
    );
  });

  it("ignores section/mobile subdomains", () => {
    expect(sourceLabelFromUrl("https://sport.detik.com/a")).toBe("Detik");
    expect(sourceLabelFromUrl("https://bola.okezone.com/a")).toBe("Okezone");
    expect(sourceLabelFromUrl("https://jabar.tribunnews.com/a")).toBe(
      "Tribunnews",
    );
    expect(sourceLabelFromUrl("https://m.kompas.com/a")).toBe("Kompas");
  });

  it("handles two-label Indonesian TLDs", () => {
    expect(sourceLabelFromUrl("https://bandung.go.id/berita")).toBe("Bandung");
    expect(sourceLabelFromUrl("https://www.bankbjb.co.id/news")).toBe("Bankbjb");
  });

  it("title-cases hyphenated brands", () => {
    expect(sourceLabelFromUrl("https://www.pikiran-rakyat.com/z")).toBe(
      "Pikiran-Rakyat",
    );
  });

  it("returns null for missing, unparseable, or bare-IP URLs", () => {
    expect(sourceLabelFromUrl(null)).toBeNull();
    expect(sourceLabelFromUrl(undefined)).toBeNull();
    expect(sourceLabelFromUrl("")).toBeNull();
    expect(sourceLabelFromUrl("not a url")).toBeNull();
    expect(sourceLabelFromUrl("https://192.168.1.10/x")).toBeNull();
  });
});

describe("rewriteCreditsInContent", () => {
  it("replaces scraper figcaption credits that say Lensaplus", () => {
    const html =
      '<figure><img src="/uploads/a.jpg" /><figcaption class="text-xs">Foto: Lensaplus</figcaption></figure>';
    expect(rewriteCreditsInContent(html, "Bola")).toContain("Foto: Bola");
    expect(rewriteCreditsInContent(html, "Bola")).not.toContain("Lensaplus");
  });

  it("replaces rich-text <em>Sumber: Lensaplus</em> credits", () => {
    const html =
      "<figcaption>Suasana laga — <em>Sumber: Lensaplus</em></figcaption>";
    expect(rewriteCreditsInContent(html, "Detik")).toContain(
      "<em>Sumber: Detik</em>",
    );
  });

  it("rewrites the attribution footer link text", () => {
    const html =
      '<p class="x">Disarikan dari rilis <a href="https://www.bola.com/news/123" rel="nofollow">Lensaplus — "Judul Asli"</a>. Versi Lensaplus ditulis ulang.</p>';
    const out = rewriteCreditsInContent(html, "Bola");
    expect(out).toContain('>Bola — "Judul Asli"');
    expect(out).not.toContain(">Lensaplus —");
    // The trailing "Versi Lensaplus" sentence must stay untouched.
    expect(out).toContain("Versi Lensaplus ditulis ulang");
  });

  it("leaves non-credit body mentions of Lensaplus alone", () => {
    const html = "<p>Menurut Lensaplus, acara berjalan lancar.</p>";
    expect(rewriteCreditsInContent(html, "Bola")).toBe(html);
  });

  it("is idempotent once credits already point at the real source", () => {
    const html =
      '<figcaption class="t">Foto: Lensaplus</figcaption>';
    const once = rewriteCreditsInContent(html, "Bola");
    expect(rewriteCreditsInContent(once, "Bola")).toBe(once);
  });

  it("escapes HTML-special characters in the label", () => {
    const html = '<figcaption>Foto: Lensaplus</figcaption>';
    expect(rewriteCreditsInContent(html, 'A&B')).toContain("Foto: A&amp;B");
  });
});

describe("footerSourceHref", () => {
  it("extracts the upstream href from the footer", () => {
    const html =
      'Disarikan dari rilis <a href="https://sport.detik.com/abc" target="_blank">Lensaplus — "x"</a>';
    expect(footerSourceHref(html)).toBe("https://sport.detik.com/abc");
  });
  it("returns null when there is no footer", () => {
    expect(footerSourceHref("<p>no footer here</p>")).toBeNull();
  });
});

describe("uploadUrlsInContent", () => {
  it("collects distinct /uploads/ image urls", () => {
    const html =
      '<img src="/uploads/a.jpg" /><img src="/uploads/b.png" /><img src="/uploads/a.jpg" />';
    expect(uploadUrlsInContent(html).sort()).toEqual([
      "/uploads/a.jpg",
      "/uploads/b.png",
    ]);
  });
});

describe("sourceWebsiteFromUrl & formatSourceWithWebsite", () => {
  it("extracts clean website hostname without www/m/amp", () => {
    expect(sourceWebsiteFromUrl("https://www.bola.com/indonesia/read/1")).toBe("bola.com");
    expect(sourceWebsiteFromUrl("https://m.kompas.com/news")).toBe("kompas.com");
    expect(sourceWebsiteFromUrl("https://www.bankbjb.co.id/page/berita")).toBe("bankbjb.co.id");
    expect(sourceWebsiteFromUrl("not-a-url")).toBeNull();
  });

  it("formats source name with (websitenya) without duplicating if already present", () => {
    expect(
      formatSourceWithWebsite("Bola", "https://www.bola.com/indonesia/read/1")
    ).toBe("Bola (bola.com)");
    expect(
      formatSourceWithWebsite("Bank BJB", "https://www.bankbjb.co.id/page/berita")
    ).toBe("Bank BJB (bankbjb.co.id)");
    expect(
      formatSourceWithWebsite("Bola (bola.com)", "https://www.bola.com/indonesia/read/1")
    ).toBe("Bola (bola.com)");
    expect(
      formatSourceWithWebsite("bola.com", "https://www.bola.com/indonesia/read/1")
    ).toBe("bola.com");
  });

  it("strips the legacy Disarikan dari rilis / tim editorial dengan dukungan AI footer paragraph", () => {
    const html =
      '<p>Paragraf utama artikel.</p><p class="text-sm italic text-txt-muted mt-8 pt-4 border-t border-border">Disarikan dari rilis <a href="https://www.manutd.com/en/news/detail/why-tooney-has-been-back-to-school" target="_blank" rel="nofollow noopener">Manutd (manutd.com) — "Why Tooney has been back to school!"</a>. Versi Lensaplus ditulis ulang oleh tim editorial dengan dukungan AI; fakta dan kutipan tetap mengacu ke publikasi asli.</p>';
    expect(stripAttributionFooter(html)).toBe("<p>Paragraf utama artikel.</p>");
  });
});
