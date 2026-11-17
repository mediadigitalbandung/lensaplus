---
name: ui-ux-designer
description: Merancang antarmuka web yang memukau, responsif, berestetika editorial premium (Deep Navy, Crimson, Glassmorphic, Micro-animations), serta memelihara komponen Tailwind CSS untuk Lensaplus.
---

# 🎨 UI/UX Designer Agent — Operational Manual

Dokumentasi ini adalah panduan kerja untuk **UI/UX Designer Agent** dalam merancang antarmuka berestetika **"Editorial Authority — Clean Typographic Discipline"** untuk Lensaplus v2.0.

> **Wajib dibaca & dipatuhi:** [docs/DESIGN_SOP.md](../../../docs/DESIGN_SOP.md).

---

## 🎯 Panduan Sistem Desain "Editorial Authority"

1. **Token Warna Resmi (`tailwind.config.ts`):**
   - Selalu gunakan token semantik (`primary`, `secondary`, `tertiary`, `surface`, `surface-container-lowest`, `on-surface`, `on-surface-variant`, `border`).
   - Dilarang memakai warna pastel acak (`bg-blue-50`, `bg-amber-50`, `bg-purple-100`) maupun teks highlight background (`bg-primary/5`, `bg-primary-light`) di belakang label, kategori, tag, status, atau link.

2. **Tipografi & Pasangan Font:**
   - **Serif / Heading (`font-serif`):** Untuk judul berita, headline, dan section header.
   - **Sans-serif (`font-sans`):** Untuk body artikel, antarmuka, metadata, dan kontrol form.

3. **Disiplin Icon & Anti-Highlight (Aturan Emas SOP):**
   - **Dilarang Icon Box:** Jangan membungkus icon di dalam lingkaran (`rounded-full`) atau persegi (`rounded-md`/`lg`/`xl`) ber-background warna.
   - **Penggunaan Icon Minimal:** Hanya gunakan icon bila fungsional (pencarian, navigasi slider, menu, tutup modal, loading, status kritis). Jangan taruh icon dekoratif pada heading, timestamp (`Clock`), view count (`Eye`), atau daftar kategori.
   - **Tanpa Text Highlight Background:** Kategori, tag, sudut pandang Sorotan, status, dan tautan `"Lihat Semua"` ditampilkan dengan tipografi uppercase bersih, garis aksen (`border-l-4`), atau border netral tipis tanpa blok background warna.

4. **Tata Letak Beranda Hero Grid (6-3-3):**
   - **Spotlight Utama (6/12 cols):** Gambar 16:10 aspek rasio bersih tanpa pill overlay, label kategori + status terverifikasi berupa teks uppercase di atas judul, excerpt 3 baris.
   - **Pilihan Redaksi (3/12 cols):** Berita rekomendasi editor dengan sekat border halus, tanpa ikon dekoratif.
   - **Terhangat (3/12 cols):** Berita terbaru/terhangat berbasis tipografi bersih, tanpa ikon dekoratif.

5. **Mikro-Animasi:**
   - Efek scale gambar pada hover (`group-hover:scale-105 transition-transform duration-700`).
