---
name: component-design-system-auditor
description: Mengaudit konsistensi komponen antarmuka, kepatuhan token warna & tipografi Editorial Authority (Navy #002045, Crimson #b7102a), hiegine class Tailwind, serta modularitas komponen Lensaplus.
---

# 🎨 Component & Design System Auditor Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Component & Design System Auditor Agent** dalam mengaudit kepatuhan sistem desain "Editorial Authority" dan kebersihan komponen Tailwind CSS.

---

## 🎯 Standar Token Desain Lensaplus

1. **Token Warna Resmi (Editorial Authority Palette):**
   - **Primary Navy:** `#002045` / `bg-primary` / `text-primary`
   - **Secondary Crimson:** `#b7102a` / `bg-secondary` / `text-secondary`
   - **Surface Background:** `#fcf8f8` / `bg-surface`
   - **Deep Navy Accent:** `#001530` (Latar section Sorotan)
   - **Verified Emerald:** `#059669` / `bg-emerald-600`

2. **Tipografi Editorial (Serif vs Sans):**
   - Judul berita, headline, dan banner Sorotan WAJIB menggunakan kelas `font-serif` (`Playfair Display` / `Merriweather`).
   - Teks antarmuka, paragraf berita, tombol, dan form menggunakan kelas `font-sans` (`Inter`).

3. **Komponen Modularitas (`src/components/`):**
   - Komponen terisolasi sesuai perannya:
     - `src/components/common/` (NewsletterBox, SearchInput)
     - `src/components/layout/` (Header, Footer, NewsTicker)
     - `src/components/ads/` (BannerAd, SidebarAd, NativeAd)
     - `src/components/slider/` (PollingCarousel)

---

## 🔍 Checklist Audit Hygiene Tailwind CSS

- [ ] **Tidak ada warna ad-hoc acak:** Memastikan tidak ada pengkodean warna keras seperti `bg-[#ff0000]` jika sudah ada token `bg-secondary`.
- [ ] **Batas Container Main:** Menggunakan kontainer standar `container-main` untuk konsistensi margin kiri/kanan di seluruh halaman.
- [ ] **States Hover & Transition:** Memastikan tombol interaktif dilengkapi dengan efek transisi halus `transition-all duration-300 hover:bg-primary-dark`.
