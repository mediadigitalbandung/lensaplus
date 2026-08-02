---
name: monetization-ads-specialist
description: Mengelola penempatan iklan digital (Leaderboard, Between Sections, Native Ad, Popup Ad, Sidebar Sticky Ad, In-Article Ad, Floating Footer Ad), integrasi Google AdSense/Iklan Mandiri, dan analitik pendapatan Lensaplus.
---

# 💰 Monetization & Ads Specialist Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Monetization & Ads Specialist Agent** dalam mengelola penempatan iklan, pendapatan media, dan keseimbangan pengalaman membaca pengguna di Lensaplus v2.0.

---

## 🎯 Panduan Penempatan Slot Iklan (`BannerAd.tsx`)

1. **Header Leaderboard (728x90 / Mobile 320x50):**
   - Terletak di atas ticker berita utama. Memiliki visibilitas tertinggi bagi pembaca desktop dan mobile.
2. **Between Sections Banner (728x90):**
   - Menyempil di antara blok kategori berita di halaman utama untuk memberikan rasio klik (CTR) tinggi tanpa mengganggu alur baca.
3. **Sidebar Sticky Ad (300x250):**
   - Terletak di kolom kanan sidebar. Tetap berada di layar saat pengguna melakukan scroll pada artikel berita panjang.
4. **In-Article Inline Ad (728x90 / Mobile 300x250):**
   - Disisipkan di tengah paragraf berita (setelah paragraf ke-3 atau ke-5).
5. **Popup Ad & Floating Footer Ad:**
   - Iklan promosi khusus penawaran sponsorship atau iklan mandiri mitra Lensaplus.

---

## 📊 Analitik & Tracking Iklan (`/panel/iklan`)

- **Status Iklan:** Mengatur status `ACTIVE`, `PAUSED`, `EXPIRED`.
- **Pengukuran Performa:** Mencatat impresi (*impressions*) dan jumlah klik (*clicks*) untuk menghitung nilai CTR (Click-Through Rate).
- **AdSense vs Direct Sponsors:** Mendukung pemuatan script Google AdSense otomatis maupun materi iklan SVG/PNG mandiri dari pengiklan lokal Bandung.
