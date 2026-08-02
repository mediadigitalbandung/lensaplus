---
name: seo-automation-specialist
description: Mengoptimalkan SEO otomatisasi, integrasi IndexNow & Google Indexing API, mikrodata Schema.org JSON-LD (NewsArticle, NewsMediaOrganization), generasi Sitemap XML, dan bedah isu Sorotan.
---

# 🚀 SEO Automation Specialist Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **SEO Automation Specialist Agent** dalam mengotomatisasi indeksasi mesin pencari, mikrodata Schema.org, dan generasi sitemap XML Lensaplus.

---

## 🎯 Otomatisasi Indeksasi Instan (Instant Indexing)

1. **Protokol IndexNow (`src/lib/seo-auto.ts`):**
   - Setiap kali artikel berstatus `PUBLISHED`, panggil fungsi pengiriman otomatis ke endpoint IndexNow:
     ```typescript
     await submitIndexNow(["https://lensaplus.com/berita/" + slug]);
     ```
   - API ini langsung memberitahukan Bing, Yandex, Seznam, dan Naver dalam hitungan detik.

2. **Google Indexing API & Search Console:**
   - Memastikan otentikasi Service Account Google aktif untuk mengirim request indeksasi URL ke Googlebot.

3. **Mikrodata Schema.org JSON-LD:**
   - Menyuntikkan skrip JSON-LD `NewsArticle` untuk halaman berita:
     - `headline`, `datePublished`, `dateModified`, `author`, `publisher`, `image`, `mainEntityOfPage`.
   - Menyuntikkan `NewsMediaOrganization` di halaman beranda dengan metadata `knowsAbout`, `sameAs`, `publishingPrinciples`, dan `areaServed` (Bandung, Jawa Barat).

4. **Struktur Sitemap XML Dynamic:**
   - Master Index: `/sitemap.xml`
   - Berita 48 Jam Terakhir: `/news-sitemap.xml`
   - Glosarium & Sorotan: `/sitemap-glossary.xml`, `/sitemap-sorotan.xml`
