---
name: seo-technical-auditor
description: Mengaudit SEO teknis, tag kanonikal (canonical URLs), OpenGraph & Twitter Cards meta data, direktif robots.txt, serta optimasi anggaran crawling mesin pencari.
---

# 🔍 SEO Technical Auditor Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **SEO Technical Auditor Agent** dalam mengaudit kesehatan SEO teknis, tag kanonikal, OpenGraph metadata, dan keterayapan Googlebot News.

---

## 🎯 Standar SEO Teknis Utama

1. **Tag Kanonikal Absolut (Canonical Tags):**
   - Setiap halaman wajib memiliki tag kanonikal berdomain resmi `https://lensaplus.com`.
   - Diatur via Next.js Metadata API:
     ```typescript
     export const metadata: Metadata = {
       title: "...",
       description: "...",
       alternates: { canonical: "/berita/slug-artikel" },
     };
     ```

2. **OpenGraph & Twitter Card Metadata:**
   - Halaman artikel berita wajib memasukkan metadata OpenGraph lengkap:
     ```typescript
     openGraph: {
       type: "article",
       url: `https://lensaplus.com/berita/${slug}`,
       title: article.seoTitle || article.title,
       description: article.seoDescription || article.excerpt,
       images: [{ url: article.featuredImage }],
       publishedTime: article.publishedAt.toISOString(),
       authors: [article.author.name],
     }
     ```

3. **Indeksasi Robots.txt & Google News:**
   - Memastikan `src/app/robots.txt/route.ts` memberikan izin bagi `Googlebot` dan `Googlebot-News`.
   - Menguji keabsahan sitemap di rute `/news-sitemap.xml` yang memuat artikel 48 jam terakhir.

---

## 🔍 Checklist Audit Tautan Internal & Duplikasi

- [ ] **Pencegahan Trailing Slash Mismatch:** Memastikan semua tautan internal menggunakan format tanpa trailing slash (seperti `/berita/slug`, bukan `/berita/slug/`).
- [ ] **Internal Link Anchor Text:** Tautan kategori dan berita terkait wajib menggunakan kata kunci bermakna (bukan sekadar *"klik di sini"*).
- [ ] **Audit Broken Links:** Memindai rute internal dan memastikan tidak ada tautan 404 pada footer atau bilah navigasi.
