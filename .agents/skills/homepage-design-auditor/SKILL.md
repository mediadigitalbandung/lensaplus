---
name: homepage-design-auditor
description: Mengaudit dan mengawasi keseragaman tata letak antarmuka Halaman Utama (Homepage) Lensaplus, kepatuhan token sistem desain Editorial Authority (Navy #002045, Crimson #b7102a, Surface #fcf8f8), hirarki tipografi serif/sans, responsivitas grid, dan keselarasan komponen visual.
---

# 🏠 Homepage Design Auditor Agent — Operational Manual

Dokumentasi ini menetapkan standar audit dan aturan preservasi antarmuka **Halaman Utama (Homepage)** Lensaplus v2.0 agar senantiasa seragam, elegan, dan profesional berstandar media berita digital nasional.

> **Sumber Kebenaran Utama:** Seluruh aturan wajib merujuk pada [docs/DESIGN_SOP.md](../../../docs/DESIGN_SOP.md).

---

## 🎯 Standar Visual & Token Desain Halaman Utama

1. **Warna & Palet Resmi (`tailwind.config.ts`):**
   - Gunakan token semantik resmi (`bg-primary`, `text-primary`, `text-secondary`, `text-tertiary`, `bg-surface`, `text-on-surface`, `border-border`).
   - Dilarang memberi warna highlight pastel/tint (`bg-primary/5`, `bg-primary/10`, `bg-primary-light`, `bg-blue-50`, `bg-emerald-50`, dll.) di belakang teks label, kategori, sudut pandang, atau tautan.

2. **Tipografi & Hirarki Teks:**
   - **Judul Berita & Section Header:** Wajib menggunakan kelas `font-serif`.
   - **Metadata & Subtitle:** Gunakan kelas `font-sans`, warna `text-stone-500` / `text-stone-600`, dengan ukuran yang terstruktur (`text-label-sm`, `text-body-md`).

3. **Keseragaman Header Section (Editorial Clean):**
   - Setiap section utama (Berita Terkini, Bedah Isu & Sorotan, Pilihan Editor, Rangkuman Pintar, Kategori Berita) WAJIB menggunakan struktur header yang bersih:
     - **ZERO Icon Box:** Dilarang membungkus icon dengan kontainer lingkaran (`rounded-full`) maupun persegi (`rounded-lg`, `rounded-xl`).
     - **ZERO Decorative Heading Icon:** Section header memakai garis aksen editorial `border-l-4 border-primary pl-3` atau sub-label uppercase bersih (`text-xs font-bold uppercase tracking-widest`), tanpa ikon hiasan (`Flame`, `Sparkles`, `BookOpen`, `Layers`, `categoryIconMap`, dll.).
     - Judul serif `text-headline-sm sm:text-headline-md`.
     - Tautan CTA `"Lihat Semua"` berupa teks bersih (`text-label-md font-bold uppercase tracking-wider text-primary`), **tanpa** background pill/highlight warna.

4. **Keseragaman Kartu Berita (Card Standard):**
   - Gambar artikel menggunakan rasio baku `aspect-[16/10]` atau `aspect-[3/2]` dengan sudut `rounded-2xl` atau `rounded-xl`, bersih tanpa tempelan pill warna di atas foto.
   - Animasi hover pada gambar: `transition-transform duration-700 ease-out group-hover:scale-105`.
   - Kategori dan status `Terverifikasi` ditampilkan sebagai teks uppercase bersih di atas judul, bukan highlight pill berwarna.
   - Metadata artikel (Penulis & Waktu) ditampilkan sebagai teks bersih tanpa icon jam (`Clock`) atau icon mata (`Eye`) berulang, dengan garis pemisah tipis `border-t border-stone-200/50`.

---

## 🔍 Checklist Audit Halaman Utama

- [ ] **Zero Icon Boxes:** Tidak ada icon di dalam kontainer `rounded-full` atau `rounded-md/lg/xl` ber-background warna.
- [ ] **Minimal Icon Usage:** Tidak ada icon dekoratif pada section header, kategori, timestamp, atau kartu rangkuman.
- [ ] **Zero Text Highlight Backgrounds:** Tidak ada kategori, sudut pandang, status, atau tautan `"Lihat Semua"` dengan latar highlight warna.
- [ ] **Section Header Standard:** Semua section menggunakan tipografi & garis aksen editorial yang konsisten.
- [ ] **Rasio Gambar Seragam:** Tidak ada gambar dengan aspect ratio acak yang merusak alignment grid.
- [ ] **Responsivitas Perangkat Mobile:** Grid berpindah secara mulus dari 1 kolom (Mobile) ke 2-3 kolom (Tablet) dan 4-12 kolom (Desktop).
- [ ] **Zero Asset Leak:** Tidak ada gambar atau teks placeholder generik/luar yang tidak sesuai brand Lensaplus.
