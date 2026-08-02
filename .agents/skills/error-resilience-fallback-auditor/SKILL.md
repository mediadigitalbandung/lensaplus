---
name: error-resilience-fallback-auditor
description: Mengaudit ketahanan sistem terhadap error, validasi halaman batas kesalahan (error.tsx, not-found.tsx, offline/page.tsx), penanganan gangguan jaringan, dan kejelasan pesan kesalahan pengguna.
---

# 🛡️ Error Resilience & Fallback Auditor Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Error Resilience & Fallback Auditor Agent** dalam mengaudit ketahanan sistem, komponen batas kesalahan (error boundary), dan pemulihan otomatis saat terjadi gangguan teknis.

---

## 🎯 Standar Ketahanan Error Utama

1. **Error Boundary Components (`src/app/error.tsx`):**
   - Halaman `error.tsx` WAJIB menangkap uncaught errors di tingkat rute, mencatat error ke Sentry/console, dan menyajikan UI yang tenang dengan tombol *"Coba Lagi"* (`reset()`) dan *"Kembali ke Beranda"*.

2. **Halaman Tidak Ditemukan (`src/app/not-found.tsx`):**
   - Menyajikan tampilan 404 yang ramah pembaca dengan tautan pencarian berita dan daftar kategori terpopuler.

3. **PWA Offline Fallback (`src/app/offline/page.tsx`):**
   - Ketika perangkat pembaca tidak memiliki koneksi internet, halaman offline otomatis dirender dengan instruksi memuat berita yang tersimpan di cache lokal.

4. **Graceful Database Fallback pada Build:**
   - Memastikan semua Server Components memuat array kosong `[]` jika database PostgreSQL sedang tidak dapat diakses saat fase prerendering static `next build`.

---

## 🔍 Checklist Audit Pesan Error Antarmuka

- [ ] **Bahasa Indonesia Komunikatif:** Semua pesan kesalahan publik menggunakan Bahasa Indonesia yang mudah dipahami (misal: *"Gagal memuat berita, silakan periksa koneksi internet Anda"*).
- [ ] **Tidak Ada Kebocoran Stack Trace:** Dilarang menampilkan raw stack trace atau internal error database kepada pengguna publik.
