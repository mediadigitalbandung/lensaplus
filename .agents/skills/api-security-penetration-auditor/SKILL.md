---
name: api-security-penetration-auditor
description: Mengaudit keamanan API (/api/*), pengujian penetrasi endpoint, otentikasi Bearer secret cron, enkripsi parameter input, serta pencegahan SQLi/XSS/SSRF.
---

# 🔐 API Security & Penetration Auditor Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **API Security & Penetration Auditor Agent** dalam mengaudit ketahanan endpoint API `/api/*`, pengujian penetrasi, otentikasi cron, dan penangkalan serangan siber.

---

## 🎯 Standar Keamanan API Utama

1. **Otentikasi Cron Secrets (`Authorization: Bearer ${CRON_SECRET}`):**
   - Seluruh rute otomatisasi cron (`/api/cron/*`, `/api/seo/*`) WAJIB memvalidasi header otentikasi via `verifyCronSecret(req)`:
     ```typescript
     if (!verifyCronSecret(req)) {
       return errorResponse("UNAUTHORIZED", "Invalid cron authorization header", 401);
     }
     ```

2. **Sanitasi Parameter Input & Penangkalan SQL Injection:**
   - Karena Lensaplus menggunakan Prisma ORM dengan *parameterized queries*, pastikan tidak ada kueri SQL mentah (`$queryRaw`) yang menggabungkan string secara langsung.
   - Semua input teks publik (`/api/comments`, `/api/newsletter/subscribe`) WAJIB dibersihkan dari tag script jahat menggunakan `sanitizeHtml()`.

3. **Pencegahan SSRF (Server-Side Request Forgery):**
   - Rute pemrosesan scraper berita eksternal WAJIB memvalidasi URL target dan membatasi domain ke allowlist domain berita Indonesia terpercaya.

4. **Rate Limiting & Anti-Brute Force:**
   - Endpoint publik (seperti `/api/auth/[...nextauth]`, `/api/polls/[id]/vote`, `/api/newsletter/subscribe`) WAJIB menerapkan pembatasan frekuensi request (`rateLimit`).

---

## 🔍 Checklist Audit Penetrasi Endpoint API

- [ ] **Endpoint `/api/users/*`:** Memastikan data password ter-hash dengan algoritma Bcrypt (cost factor >= 12).
- [ ] **Endpoint `/api/push/send`:** Hanya dapat dipanggil oleh pengirim berwenang atau cron terproteksi.
- [ ] **Header Keamanan API:** Mengembalikan header CORS yang dibatasi hanya untuk domain Lensaplus.
