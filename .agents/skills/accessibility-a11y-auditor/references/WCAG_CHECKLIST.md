# Lensaplus Accessibility (A11y) WCAG 2.1 AA Checklist

Dokumen ini memuat standar periksa aksesibilitas web berstandar WCAG 2.1 Level AA untuk **Accessibility (A11y) Auditor Agent**.

---

## 1. Periksa Navigasi Keyboard & Focus Visibility

- [ ] Seluruh tombol, tautan, input form, polling carousel item, dan tombol drawer dapat difokuskan menggunakan tombol `Tab`.
- [ ] Indikator fokus visual (*focus ring*) tampil jelas dengan kontras tinggi (`focus-visible:ring-2 focus-visible:ring-primary`).
- [ ] Tombol penutup modal mendukung pembatalan via tombol `Escape`.

---

## 2. Periksa Atribut ARIA & HTML Semantik

- [ ] Drawer menu seluler: `aria-expanded={isOpen}`, `aria-controls="mobile-menu"`.
- [ ] Tombol tanpa teks (seperti ikon pencarian/dark mode): `aria-label="Cari Berita"` atau `aria-label="Ganti Mode Tampilan"`.
- [ ] Gambar ilustrasi berita: tag `alt` memuat deskripsi visual singkat (misal: `alt="Gedung Sate Bandung saat matahari terbenam"`).
- [ ] Hierarki Heading: 1 tag `<h1>` per halaman, diikuti oleh `<h2>` dan `<h3>` secara teratur.

---

## 3. Periksa Kontras Warna (Minimal 4.5:1)

- [ ] Teks Navy `#002045` di atas latar putih `#ffffff` -> Ratio > 12:1.
- [ ] Teks Crimson `#b7102a` di atas latar `#ffffff` -> Ratio > 5.2:1.
- [ ] Teks section Sorotan `#001530` di atas latar `#ffffff` -> Ratio > 15:1.
