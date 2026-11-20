import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  cleanSorotanTitle,
  formatSorotanHtml,
  sorotanToPlainText,
} from "../seo/sorotan-format";

describe("formatSorotanHtml", () => {
  it("preserves clean structured editorial HTML from production Sorotan rows", () => {
    const prodHtml = `<p>Pertemuan darurat antara USLPA &amp; pemain Brooklyn FC digelar Kamis malam.</p>

<h2>Evaluasi Liga Menjadi Penentu Arah Klub</h2>
<p>Presiden Liga <strong>Paul McDonough</strong> menyebut <em>evaluasi</em> terus berjalan.</p>
<ul>
  <li>Degradasi ke USL League One</li>
  <li>Pembayaran pesangon sesuai CBA</li>
</ul>
<blockquote>"Semua pemain kini berhak menerima pesangon."</blockquote>`;

    const out = formatSorotanHtml(prodHtml);
    expect(out).toContain("<p>Pertemuan darurat antara USLPA &amp; pemain Brooklyn FC digelar Kamis malam.</p>");
    expect(out).toContain("<h2>Evaluasi Liga Menjadi Penentu Arah Klub</h2>");
    expect(out).toContain("<strong>Paul McDonough</strong>");
    expect(out).toContain("<em>evaluasi</em>");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>Degradasi ke USL League One</li>");
    expect(out).toContain("<li>Pembayaran pesangon sesuai CBA</li>");
    expect(out).toContain('<blockquote>"Semua pemain kini berhak menerima pesangon."</blockquote>');
    // Idempotent
    expect(formatSorotanHtml(out)).toBe(out);
  });

  it("converts plain-text paragraphs separated by blank lines or single newlines into <p> tags", () => {
    const doubleNl = `Paragraf pertama tentang Inter Milan.\n\nParagraf kedua tentang kontrak pemain.`;
    expect(formatSorotanHtml(doubleNl)).toBe(
      "<p>Paragraf pertama tentang Inter Milan.</p>\n<p>Paragraf kedua tentang kontrak pemain.</p>",
    );

    const singleNl = `Paragraf pertama.\nParagraf kedua.`;
    expect(formatSorotanHtml(singleNl)).toBe(
      "<p>Paragraf pertama.</p>\n<p>Paragraf kedua.</p>",
    );
  });

  it("wraps bare opening text followed by HTML blocks cleanly (mixed format)", () => {
    const mixed = `Kemenangan dramatis Persib Bandung 2-1 atas Melbourne Victory bukan sekadar tiga poin.

<p>Penyebab lolosnya Maung Bandung terletak pada konsistensi lini tengah.</p>

<blockquote>"Sekarang bukan saatnya memikirkan istirahat."</blockquote>`;

    const out = formatSorotanHtml(mixed);
    expect(out).toBe(
      `<p>Kemenangan dramatis Persib Bandung 2-1 atas Melbourne Victory bukan sekadar tiga poin.</p>\n` +
        `<p>Penyebab lolosnya Maung Bandung terletak pada konsistensi lini tengah.</p>\n` +
        `<blockquote>"Sekarang bukan saatnya memikirkan istirahat."</blockquote>`,
    );
    expect(formatSorotanHtml(out)).toBe(out);
  });

  it("demotes <h1> to <h2>, normalizes <h4>-<h6> to <h3>, and maps <b>/<i> to <strong>/<em>", () => {
    const input = `<h1>Subjudul Utama</h1><p>Isi <b>tebal</b> dan <i>miring</i>.</p><h4>Subbagian</h4><p>Detail.</p>`;
    const out = formatSorotanHtml(input);
    expect(out).not.toContain("<h1");
    expect(out).not.toContain("<h4");
    expect(out).toContain("<h2>Subjudul Utama</h2>");
    expect(out).toContain("<h3>Subbagian</h3>");
    expect(out).toContain("<strong>tebal</strong>");
    expect(out).toContain("<em>miring</em>");
  });

  it("repairs truncated/unclosed trailing tags (e.g. `</` or `</p` from token cutoffs)", () => {
    const truncatedSlash = `<p>Hal terburuk bagi klub adalah memilih pelatih tanpa keyakinan semua pihak.</`;
    expect(formatSorotanHtml(truncatedSlash)).toBe(
      "<p>Hal terburuk bagi klub adalah memilih pelatih tanpa keyakinan semua pihak.</p>",
    );

    const truncatedP = `<p>Keberhasilan Real Madrid di bawah Calafat.</p`;
    expect(formatSorotanHtml(truncatedP)).toBe(
      "<p>Keberhasilan Real Madrid di bawah Calafat.</p>",
    );

    const truncatedHeading = `<p>Paragraf selesai.</p><h2`;
    expect(formatSorotanHtml(truncatedHeading)).toBe("<p>Paragraf selesai.</p>");
  });

  it("unescapes single- and double-escaped HTML tags while preserving comparison operators", () => {
    const singleEscaped =
      `&lt;h1&gt;Ringkasan&lt;/h1&gt;\n&lt;p&gt;Inflasi &lt; 3% dan pertumbuhan &gt; 5%.&lt;/p&gt;`;
    const out1 = formatSorotanHtml(singleEscaped);
    expect(out1).toBe(
      "<h2>Ringkasan</h2>\n<p>Inflasi &lt; 3% dan pertumbuhan &gt; 5%.</p>",
    );

    const doubleEscaped =
      `&amp;lt;h2&amp;gt;Bab Satu&amp;lt;/h2&amp;gt;&amp;lt;p&amp;gt;A &amp;amp; B&amp;lt;/p&amp;gt;`;
    const out2 = formatSorotanHtml(doubleEscaped);
    expect(out2).toBe("<h2>Bab Satu</h2>\n<p>A &amp; B</p>");

    const plainComparison = `Target inflasi < 3% dan pertumbuhan > 5% tahun ini.`;
    const out3 = formatSorotanHtml(plainComparison);
    expect(out3).toBe(
      "<p>Target inflasi &lt; 3% dan pertumbuhan &gt; 5% tahun ini.</p>",
    );
  });

  it("converts Markdown headings, bold/italic, lists, blockquotes, links, and code fences", () => {
    const md = [
      "```html",
      "# Poin Utama",
      "",
      "Paragraf dengan **penekanan kuat**, *istilah asing*, `kode`, dan [sumber resmi](https://example.com).",
      "",
      "### Rincian Dampak",
      "",
      "- Biaya logistik turun 2*3*4 = 24%",
      "- Distribusi 10 * 5 lebih lancar",
      "",
      "1. Langkah awal",
      "2. Evaluasi kuartalan",
      "",
      '> "Kebijakan ini langsung terasa," ujarnya.',
      "```",
    ].join("\n");

    const out = formatSorotanHtml(md);
    expect(out).toContain("<h2>Poin Utama</h2>");
    expect(out).toContain(
      "<p>Paragraf dengan <strong>penekanan kuat</strong>, <em>istilah asing</em>, kode, dan sumber resmi.</p>",
    );
    expect(out).toContain("<h3>Rincian Dampak</h3>");
    expect(out).toContain("<ul><li>Biaya logistik turun 2*3*4 = 24%</li><li>Distribusi 10 * 5 lebih lancar</li></ul>");
    expect(out).toContain("<ol><li>Langkah awal</li><li>Evaluasi kuartalan</li></ol>");
    expect(out).toContain('<blockquote><p>"Kebijakan ini langsung terasa," ujarnya.</p></blockquote>');
    expect(out).not.toContain("```");
    expect(formatSorotanHtml(out)).toBe(out);
  });

  it("normalizes wrapper divs, full html documents, double <br>, multiline headings, and orphan <li>", () => {
    const divs = `<div>Paragraf div satu</div><div>Paragraf div dua</div>`;
    expect(formatSorotanHtml(divs)).toBe(
      "<p>Paragraf div satu</p>\n<p>Paragraf div dua</p>",
    );

    const fullDoc = `<!DOCTYPE html><html><head><title>Judul Head</title></head><body><h1>Sub</h1><p>Isi<br><br>Lanjut</p></body></html>`;
    expect(formatSorotanHtml(fullDoc)).toBe(
      "<h2>Sub</h2>\n<p>Isi</p>\n<p>Lanjut</p>",
    );

    const multilineHeading = `<h2>Judul Panjang\nDua Baris</h2><p>Isi.</p>`;
    expect(formatSorotanHtml(multilineHeading)).toBe(
      "<h2>Judul Panjang Dua Baris</h2>\n<p>Isi.</p>",
    );

    const orphanList = `<li>Butir A</li>\n<li>Butir B</li>`;
    expect(formatSorotanHtml(orphanList)).toBe(
      "<ul><li>Butir A</li><li>Butir B</li></ul>",
    );

    const spacedList = `<ul>\n  <li>Satu</li>\n\n  <li>Dua</li>\n</ul>`;
    const spacedOut = formatSorotanHtml(spacedList);
    expect(spacedOut).toContain("<ul>");
    expect(spacedOut).toContain("<li>Satu</li>");
    expect(spacedOut).toContain("<li>Dua</li>");
    expect(spacedOut).toContain("</ul>");
  });

  it("drops empty tags and strips all XSS payloads and inline attributes", () => {
    const hostile = `
      <h1 onclick="alert(1)" style="background:yellow">Judul</h1>
      <script>alert('xss')</script>
      <style>body { display: none; }</style>
      <img src="x" onerror="alert(2)" />
      <iframe src="https://evil.example">fallback</iframe>
      <svg><script>alert(3)</script></svg>
      <p></p>
      <p>&nbsp;</p>
      <h2>   </h2>
      <ul><li></li></ul>
      <p class="bg-red-50" style="color:red">Teks <a href="javascript:alert(4)">berbahaya</a> tetap aman.</p>
      &lt;script&gt;alert('escaped')&lt;/script&gt;
    `;

    const out = formatSorotanHtml(hostile);
    expect(out).toBe("<h2>Judul</h2>\n<p>Teks berbahaya tetap aman.</p>");
    expect(out).not.toMatch(/script|alert|onerror|onclick|javascript:|iframe|svg|style=|class=/i);
  });

  it("returns empty string for null, undefined, or whitespace-only inputs", () => {
    expect(formatSorotanHtml(null)).toBe("");
    expect(formatSorotanHtml(undefined)).toBe("");
    expect(formatSorotanHtml("   \n\n  ")).toBe("");
  });
});

describe("sorotanToPlainText & cleanSorotanTitle", () => {
  it("strips tags cleanly, decodes HTML entities, and avoids space before punctuation", () => {
    const html = `<p>Menurut <strong>Mauricio Pochettino</strong>, tim USLPA &amp; klub perlu evaluasi.</p><h2>Langkah Berikutnya</h2><p>Inflasi &lt; 3%.</p>`;
    expect(sorotanToPlainText(html)).toBe(
      "Menurut Mauricio Pochettino, tim USLPA & klub perlu evaluasi. Langkah Berikutnya Inflasi < 3%.",
    );
  });

  it("handles escaped tags, truncated tags, and XSS without leaking markup", () => {
    const raw = `&lt;h1&gt;Judul&lt;/h1&gt;&lt;p&gt;Isi penting.&lt;/p&gt;<script>alert(1)</script><p>Akhir.</p`;
    expect(sorotanToPlainText(raw)).toBe("Judul Isi penting. Akhir.");
  });

  it("truncates cleanly at word boundary with ellipsis only when exceeding maxLength", () => {
    expect(sorotanToPlainText("<p>Ringkasan singkat.</p>", 200)).toBe(
      "Ringkasan singkat.",
    );

    const long = `<p>Pemerintah daerah menyiapkan langkah strategis untuk mempercepat konektivitas transportasi publik di kawasan metropolitan.</p>`;
    const truncated = sorotanToPlainText(long, 60);
    expect(truncated.endsWith("…")).toBe(true);
    expect(truncated.length).toBeLessThanOrEqual(61);
    expect(truncated).not.toMatch(/\s…$/);
  });

  it("cleanSorotanTitle removes stray tags and decodes entities", () => {
    expect(cleanSorotanTitle("<h1>Kronologi: A &amp; B</h1>")).toBe(
      "Kronologi: A & B",
    );
    expect(cleanSorotanTitle("Proyeksi: Berita Nasional")).toBe(
      "Proyeksi: Berita Nasional",
    );
  });
});

describe("Sorotan public pages formatting & DESIGN_SOP compliance", () => {
  const root = process.cwd();
  const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

  it("renders /sorotan/[slug] via formatSorotanHtml & sorotanToPlainText without raw paragraph text dump", () => {
    const detailSrc = read("src/app/sorotan/[slug]/page.tsx");
    expect(detailSrc).toContain("formatSorotanHtml(sorotan.content)");
    expect(detailSrc).toContain("sorotanToPlainText(sorotan.content, 160)");
    expect(detailSrc).toContain("sorotanToPlainText(sorotan.content, 200)");
    expect(detailSrc).toContain("article-content");
    expect(detailSrc).not.toContain("sorotan.content.slice(");
    expect(detailSrc).not.toContain("paragraphs.map");
    // DESIGN_SOP: no pastel highlight backgrounds behind labels
    expect(detailSrc).not.toMatch(/\bbg-(?:blue|emerald|amber|red|purple|yellow)-50\b|\bbg-primary-light\b/);
  });

  it("renders /sorotan listing excerpts via sorotanToPlainText without ad-hoc regex", () => {
    const listSrc = read("src/app/sorotan/page.tsx");
    expect(listSrc).toContain("sorotanToPlainText(s.content, 200)");
    expect(listSrc).not.toContain(".replace(/<[^>]+>/g");
  });
});
