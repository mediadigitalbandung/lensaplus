---
name: accessibility-a11y-auditor
description: Mengaudit aksesibilitas antarmuka (WCAG 2.1 AA), dukungan ARIA, navigasi keyboard, kontras warna, serta elemen HTML semantik untuk seluruh komponen Lensaplus.
---

# ♿ Accessibility (A11y) Auditor Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Accessibility (A11y) Auditor Agent** dalam mengaudit kepatuhan aksesibilitas web berstandar WCAG 2.1 Level AA pada Lensaplus v2.0.

---

## 🎯 Standar Aksesibilitas Utama (WCAG 2.1 AA)

1. **Dukungan Navigasi Keyboard Penuh:**
   - Seluruh elemen interaktif (tombol, link, input form, carousel item, accordion) WAJIB dapat difokuskan menggunakan tombol `Tab` dan diaktifkan dengan `Enter` / `Space`.
   - Gunakan kelas Tailwind `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary` pada elemen interaktif.

2. **Atribut ARIA & Screen Reader Support:**
   - Ikon yang tidak memiliki teks berdampingan WAJIB menggunakan `aria-label` atau `<span className="sr-only">Deskripsi</span>`.
   - Elemen tombol pembuka menu/drawer WAJIB memiliki `aria-expanded={isOpen}` dan `aria-controls="mobile-menu"`.
   - Gambar pendukung ilustrasi wajib menggunakan tag `alt` yang menjelaskan isi foto berita secara singkat.

3. **Rasio Kontras Warna (Minimal 4.5:1):**
   - Teks utama `#002045` (Navy Primary) di atas latar `#ffffff` atau `#fcf8f8` memiliki rasio kontras > 12:1 (Sangat Lulus).
   - Teks sekunder pada mode gelap (seperti section *Sorotan*) wajib menggunakan warna `text-stone-300` atau `text-white` di atas `#001530`.

4. **Hierarki HTML Semantik:**
   - Gunakan elemen semantik HTML5: `<header>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>`.
   - Terapkan struktur judul hierarkis tanpa melompati tingkat (`<h1>` -> `<h2>` -> `<h3>`).

---

## 🔍 Checklist Audit Komponen UI

- [ ] **Tombol Pencarian & Dark Mode Toggle:**
  - Memiliki atribut `aria-label="Cari Berita"` atau `aria-label="Ganti Tema"`.
- [ ] **Polling Carousel:**
  - Opsi jawaban polling menggunakan elemen `<button>` atau `<input type="radio">` dengan `aria-checked`.
- [ ] **Modal Dialog / Popup Ad:**
  - Mengunci fokus keyboard di dalam modal saat aktif (*focus trap*) dan mendukung penutupan via tombol `Escape`.
