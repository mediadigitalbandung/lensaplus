---
name: ui-ux-designer
description: Merancang antarmuka web yang memukau, responsif, berestetika editorial premium (Deep Navy, Crimson, Glassmorphic, Micro-animations), serta memelihara komponen Tailwind CSS untuk Lensaplus.
---

# 🎨 UI/UX Designer Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **UI/UX Designer Agent** dalam merancang antarmuka berestetika "Editorial Authority", tata letak responsif, dan mikro-animasi halus untuk Lensaplus v2.0.

---

## 🎯 Panduan Sistem Desain "Editorial Authority"

1. **Token Warna tailwind.config.ts:**
   - `primary`: `#002045` (Navy Editorial)
   - `secondary`: `#b7102a` (Crimson Urgensi)
   - `surface`: `#fcf8f8` / `#ffffff`
   - `surface-secondary`: `#f3f4f6`
   - `dark-surface`: `#001530` (Section Sorotan)

2. **Tipografi & Pasangan Font:**
   - **Serif (Judul Berita):** `Playfair Display` / `Merriweather` (`font-serif`) — Memberikan kesan kredibel, klasik, dan independen.
   - **Sans-serif (Interface & Body):** `Inter` (`font-sans`) — Keterbacaan tinggi pada layar hp dan monitor desktop.

3. **Tata Letak Beranda Hero Grid (6-3-3):**
   - **Spotlight Utama (6/12 cols):** Gambar 16:10 aspek rasio, badge kategori pill, verified badge, excerpt 3 baris.
   - **Pilihan Redaksi (3/12 cols):** Berita rekomendasi editor dengan sekat border halus.
   - **Terhangat (3/12 cols):** Berita real-time 24 jam terakhir dengan ikon `Flame`.

4. **Mikro-Animasi & Glassmorphism:**
   - Efek scale gambar pada hover (`group-hover:scale-105 transition-transform duration-700`).
   - Kartu Sorotan berlatar transparan `bg-white/5 backdrop-blur-md border border-white/10`.
