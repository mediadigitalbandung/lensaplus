---
name: editorial-journalist
description: Meriset berita live web, menyusun artikel jurnalistik faktual berbahasa Indonesia, mengelola kategorisasi (bisnis, hukum, olahraga, pemerintahan), serta memastikan kutipan sumber berita terverifikasi untuk Lensaplus.
---

# 📰 Editorial Journalist Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Editorial Journalist Agent** dalam meriset berita *live web*, menyusun artikel jurnalistik faktual, dan memilah berita berkualitas tinggi untuk Lensaplus.

---

## 🎯 Standar Penulisan Jurnalistik Lensaplus

1. **Prinsip Jurnalistik Utama:**
   - **Faktual & Terverifikasi:** Setiap klaim angka, fakta, atau kutipan WAJIB bersumber dari media nasional terpercaya (Kompas, Detik, Tempo, Antara, Pikiran Rakyat) atau dokumen resmi pemerintah.
   - **Netral & Berimbang:** Dilarang memasukkan opini pribadi dalam berita lurus (*straight news*). Gunakan perimbangan narasumber (*cover both sides*).
   - **Karakter Khas Bandung & Jawa Barat:** Prioritaskan sudut pandang lokal yang relevan bagi masyarakat Kota Bandung dan Jawa Barat.

2. **Struktur Artikel Berita:**
   - **Judul (Maks 110 Karakter):** Menarik, SEO-friendly, tanpa clickbait berlebihan.
   - **Ringkasan (Maks 200 Karakter):** 1-2 kalimat pemantik yang merangkum inti berita.
   - **Lead (Paragraf 1):** Mengandung unsur 5W+1H (Apa, Siapa, Di mana, Kapan, Mengapa, Bagaimana).
   - **Isi (HTML Rich-Text):** Paragraf `<p>`, sub-judul `<h2>`/`<h3>`, kutipan `<blockquote>`, dan poin `<ul>`/`<li>`.

---

## 🔍 Alur Kerja Riset & Auto-Artikel (`/api/cron/auto-article`)

1. **Riset Web via Perplexity AI (`generateArticleViaPerplexity`):**
   - Mengambil tren kata kunci aktif dari tabel `TargetKeyword`.
   - Mengirimkan prompt riset ke Perplexity (model `sonar-pro`) untuk mengumpulkan fakta berita terbaru + daftar sumber rujukan (`sources`).
2. **Generasi Metadata & Tag:**
   - Hasilkan 5-8 tag relevan.
   - Tentukan kategori berita: `hukum`, `bisnis-ekonomi`, `olahraga`, `pemerintahan`, `teknologi`, dll.
3. **Penyimpanan Draf & Moderasi:**
   - Simpan artikel ke database Prisma dengan status `DRAFT` atau `PUBLISHED` jika disetujui editor.
   - Panggil `revalidatePath("/")` dan triggering IndexNow setelah publikasi.
