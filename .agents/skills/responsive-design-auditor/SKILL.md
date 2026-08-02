---
name: responsive-design-auditor
description: Mengaudit dan memastikan responsivitas 100% antarmuka Lensaplus di seluruh ukuran layar (Mobile, Tablet, Desktop, Ultra-wide), penanganan horizontal overflow, breakpoint Tailwind CSS, serta kelancaran navigasi sentuh.
---

# Responsive Design & Multi-Device Auditor Agent

Sub-agen ini bertanggung jawab secara khusus untuk memastikan bahwa seluruh halaman publik dan Dashboard Redaksi (`/panel/*`) pada **Lensaplus v2.0** memiliki tampilan yang responsif, adaptif, bebas dari kebocoran layout (*horizontal overflow*), dan nyaman digunakan pada perangkat mobile (smartphone), tablet, laptop, hingga layar monitor ultra-wide.

---

## 📐 Standar Breakpoint & Spesifikasi Layar

| Breakpoint | Ukuran (px) | Perangkat Target | Fokus Antarmuka |
|---|---|---|---|
| `xs` | `< 480px` | Smartphone ringkas | Single-column, touch target >= 44px, drawer menu |
| `sm` | `>= 640px` | Smartphone besar | Grid 2 kolom, banner terkompresi |
| `md` | `>= 768px` | Tablet & Foldable | Grid 2-3 kolom, sidebar collapsible |
| `lg` | `>= 1024px` | Laptop / iPad Pro | Grid 3-4 kolom, sidebar sticky aktif |
| `xl` | `>= 1280px` | Monitor Desktop | Container max-w-7xl, multi-sidebar layout |
| `2xl` | `>= 1536px` | Monitor Ultra-wide | Margins terpusat (`container-main`), ruang iklan opsional |

---

## 🛡️ Checklist Audit Responsivitas

1. **Pencegahan Horizontal Overflow:**
   - Memastikan tidak ada elemen (`<img>`, `<table>`, `<pre>`, `<iframe>`) yang melebihi lebar kontainer utama (`max-w-full`, `overflow-x-auto`).
   - Menerapkan `overflow-x-hidden` pada elemen `body` dan kontainer utama.

2. **Tipografi & Ruang Sentuh (Touch Targets):**
   - Menggunakan skala font responsif (contoh: `text-lg sm:text-xl lg:text-2xl`).
   - Memastikan tombol dan tautan interaktif memiliki ukuran minimal `44px x 44px` untuk kenyamanan navigasi layar sentuh.

3. **Komponen Navigasi Mobile:**
   - Navigasi atas (Header) beralih secara mulus ke Mobile Drawer Menu pada layar di bawah `768px`.
   - Floating PWA Banner dan Ticker berita menyesuaikan secara proporsional di bagian bawah layar tanpa menutupi konten utama.

4. **Tabel & Data Kompleks:**
   - Tabel direktori emiten, jadwal sidang, dan log sistem dibungkus dengan `overflow-x-auto` agar dapat di-scroll secara horizontal dengan indikator visual yang jelas.

5. **Pengujian Build & Type Safety:**
   - Menjalankan `npx tsc --noEmit` dan `npm run build` setelah setiap penyesuaian kelas Tailwind CSS.

---

## 🚀 Prosedur Eksekusi Audit Responsivitas

```bash
# 1. Audit tipe data dan kelayakan Tailwind CSS
npx tsc --noEmit

# 2. Verifikasi build produksi halaman responsif
npm run build
```
