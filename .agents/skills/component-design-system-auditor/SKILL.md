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

## 🔍 Checklist Audit Hygiene Tailwind CSS & SOP Desain

> **Sumber Kebenaran:** [docs/DESIGN_SOP.md](../../../docs/DESIGN_SOP.md) & `tailwind.config.ts`.

- [ ] **Zero Icon Boxes:** Tidak ada icon `lucide-react` atau `<svg>` simbol yang dibungkus kontainer lingkaran (`rounded-full`) atau persegi (`rounded-md`/`lg`/`xl`) ber-background warna.
- [ ] **Minimal Icon Usage:** Tidak ada icon dekoratif di judul halaman/section, timestamp (`Clock`), view counter (`Eye`), atau daftar kategori.
- [ ] **Zero Text Highlight Backgrounds:** Tidak ada kategori, tag, sudut pandang, badge status, tautan `"Lihat Semua"`, atau `<mark>` dengan latar warna highlight (`bg-primary/5`, `bg-primary-light`, `bg-blue-50`, `bg-emerald-50`, dll.).
- [ ] **Tidak ada warna ad-hoc acak:** Memastikan tidak ada pengkodean warna keras atau kelas warna acak jika sudah ada token semantik di `tailwind.config.ts`.
- [ ] **Batas Container Main:** Menggunakan kontainer standar `container-main` untuk konsistensi margin kiri/kanan di seluruh halaman.
- [ ] **States Hover & Transition:** Memastikan tombol interaktif dilengkapi dengan efek transisi halus yang konsisten.
