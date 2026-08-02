---
name: performance-lighthouse-auditor
description: Mengaudit performa Core Web Vitals (LCP, CLS, INP), ukuran bundle JavaScript Next.js, optimasi gambar/media, dan kecepatan muat halaman Lensaplus.
---

# ⚡ Performance & Lighthouse Auditor Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Performance & Lighthouse Auditor Agent** dalam memaksimalkan skor Google Lighthouse (Target > 90) dan optimasi Core Web Vitals pada Lensaplus v2.0.

---

## 🎯 Target Core Web Vitals & Performa

1. **LCP (Largest Contentful Paint) < 2.5s:**
   - Gambar hero utama di `src/app/page.tsx` WAJIB menggunakan prop `priority` dan atribut `sizes` yang presisi.
   - Gunakan format WebP/AVIF dengan kompresi kualitas 80-85%.

2. **CLS (Cumulative Layout Shift) < 0.1:**
   - Semua kontainer gambar WAJIB memiliki rasio aspek pasti (seperti `aspect-[16/10]`, `aspect-[3/2]`, `aspect-[4/3]`) atau pembungkus `relative` dengan `fill`.
   - Gunakan *Skeleton Loader* saat memuat polling atau widget berita dinamis untuk mencegah pergeseran tata letak.

3. **INP (Interaction to Next Paint) < 200ms:**
   - Minimalkan thread-blocking JavaScript pada komponen interaktif (seperti `NewsTicker`, `NewsletterBox`, dan `PollingCarousel`).

---

## 🔍 Checklist Optimasi Media & Asset

- [ ] **Next.js Image Optimization:**
  ```tsx
  <Image
    src={article.featuredImage}
    alt={article.title}
    fill
    priority={isHero}
    className="object-cover transition-transform duration-700 ease-out"
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  />
  ```
- [ ] **Font Loading Strategy:**
  - Font Google `Inter` dan `Merriweather` / `Playfair Display` wajib dikonfigurasi dengan `display: 'swap'` dan `preload: true` di `src/app/layout.tsx`.
- [ ] **Script Loading Strategy:**
  - Script pelacak atau iklan Adsense WAJIB dimuat dengan direktif `strategy="afterInteractive"` atau `strategy="lazyOnload"`.

---

## 🧪 Prosedur Audit Performa Build

1. **Analisis Ukuran Bundle Build:**
   Saat menjalankan `npm run build`, periksa output ukuran JavaScript setiap rute. Rute beranda (`/`) dan berita (`/berita/[slug]`) target First Load JS < 150 kB.
2. **Purge Cache Cloudflare:**
   Jika terjadi rilis baru dengan perubahan aset static CSS/JS, panggil endpoint purging cache:
   ```bash
   POST /api/cloudflare/purge
   ```
