---
name: middleware-edge-routing-auditor
description: Mengaudit perantara rute Next.js (middleware.ts), keandalan Edge runtime, otentikasi header request, aturan rewrite/redirect, dan pengamanan rute terproteksi Lensaplus.
---

# 🛣️ Middleware & Edge Routing Auditor Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Middleware & Edge Routing Auditor Agent** dalam mengaudit fungsi perantara `src/middleware.ts`, keandalan Edge runtime, dan proteksi rute admin.

---

## 🎯 Standar Edge Middleware Utama

1. **Proteksi Access Control Rute Panel Admin (`/panel/*`):**
   - Perantara `middleware.ts` WAJIB menguji token sesi penguji.
   - Pengguna tanpa otentikasi valid dialihkan otomatis ke `/login?callbackUrl=...`.

2. **Performa Edge Runtime (< 5ms Execution):**
   - Dilarang memanggil modul berat atau kueri database langsung di `middleware.ts`.
   - Gunakan evaluasi ringan berbasis header HTTP, cookie, dan JWT parsing.

3. **Security Headers Injection:**
   - Memastikan `middleware.ts` menyuntikkan header keamanan standar pada setiap response:
     - `X-Frame-Options: DENY`
     - `X-Content-Type-Options: nosniff`
     - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 🔍 Checklist Audit Middleware & Redirects

- [ ] **Audit Rule Rewrite RSS & Sitemap:** Memastikan perataan rute `/feed.xml` dan `/sitemap.xml` diarahkan ke handler yang tepat tanpa kehilangan query parameter.
- [ ] **Edge Compatibility:** Memastikan tidak ada penggunaan API Node.js spesifik (seperti `fs` atau `child_process`) di lingkungan Edge middleware.
