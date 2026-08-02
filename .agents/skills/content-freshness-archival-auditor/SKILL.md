---
name: content-freshness-archival-auditor
description: Mengaudit kesegaran konten (content freshness), validasi jendela revalidasi Next.js, integritas gambar/aset publik, serta deteksi halaman terisolasi (orphan pages).
---

# 📰 Content Freshness & Archival Auditor Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Content Freshness & Archival Auditor Agent** dalam mengaudit kesegaran berita utama, jendela revalidasi Next.js, dan keutuhan integritas arsip Lensaplus.

---

## 🎯 Standar Kesegaran Konten (Content Freshness)

1. **Jendela Revalidasi Halaman Utama (`revalidate = 30`):**
   - Halaman utama `src/app/page.tsx` diatur dengan `export const revalidate = 30;` untuk memastikan berita baru tampil maksimal dalam 30 detik.
   - Setiap kali artikel baru diterbitkan, API publikasi panggil `revalidatePath("/")` untuk menghapus cache instan.

2. **Deteksi Link Gambar Rusak (Broken 404 Media Links):**
   - Memastikan semua URL `featuredImage` di database mengacu ke aset publik yang valid (`/uploads/demo/*` atau URL media terverifikasi).
   - Menyediakan fallback visual otomatis jika gambar gagal dimuat.

3. **Pencegahan Orphan Pages:**
   - Memastikan setiap artikel baru otomatis terindeks pada minimal 1 kategori berita (`/kategori/[slug]`), halaman topik (`/topik`), dan sitemap berita (`/news-sitemap.xml`).

---

## 🔍 Checklist Audit Arsip & Kesegaran

- [ ] **Ticker Berita Real-Time (`NewsTicker.tsx`):** Memastikan berita terhangat 24 jam terakhir tampil pada running ticker beranda.
- [ ] **Arsip Rangkuman Berita (`/rangkuman`):** Memastikan rangkuman harian, mingguan, dan bulanan selalu memiliki draf terbarui.
- [ ] **Indeksasi Glosarium (`/glossary`):** Memastikan istilah hukum dan ekonomi terhubung dengan artikel berita terkait.
