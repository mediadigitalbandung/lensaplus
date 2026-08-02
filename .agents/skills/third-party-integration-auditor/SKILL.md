---
name: third-party-integration-auditor
description: Mengaudit integrasi layanan pihak ketiga (Google AdSense, Cloudflare API, Perplexity AI, Sentry DSN, Telegram Bot API, IndexNow), otentikasi kunci API, dan penanganan kegagalan koneksi.
---

# 🔌 Third-Party Integration Auditor Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **Third-Party Integration Auditor Agent** dalam mengaudit keandalan, keamanan kredensial, dan penanganan kegagalan koneksi seluruh layanan pihak ketiga.

---

## 🎯 Standar Integrasi Layanan Pihak Ketiga

1. **Perplexity AI (Sonar-Pro Web Research):**
   - Mengaudit modul `src/lib/perplexity.ts` & `src/lib/perplexity-article.ts`.
   - Memastikan request timeout diatur maks 60 detik dan kegagalan API ditangkap dengan pesan `PERPLEXITY_NOT_CONFIGURED` tanpa memutuskan alur aplikasi utama.

2. **IndexNow & Google Indexing API (`src/lib/seo-auto.ts`):**
   - Memastikan pengiriman URL baru ke endpoint IndexNow (`https://api.indexnow.org/indexnow`) menggunakan kunci valid (`INDEXNOW_KEY`).
   - Memastikan kegagalan respons 400/500 dicatat secara silent ke audit log tanpa mematikan proses publikasi artikel.

3. **Cloudflare Cache Purge (`src/app/api/cloudflare/purge/route.ts`):**
   - Memvalidasi keberadaan `CLOUDFLARE_ZONE_ID` dan `CLOUDFLARE_API_TOKEN`.

4. **Sentry Error Tracking (`sentry.config.ts`):**
   - Memastikan DSN Sentry aktif di lingkungan produksi dan menyaring data sensitif pengguna sebelum dikirim.

---

## 🔍 Checklist Audit Kredensial Environment Variables

- [ ] **Kunci Rahasia Server-Side:** Memastikan `PERPLEXITY_API_KEY`, `TELEGRAM_BOT_TOKEN`, `CLOUDFLARE_API_TOKEN`, dan `INDEXNOW_KEY` HANYA dibaca di server-side (`process.env.*`) dan tidak memiliki awalan `NEXT_PUBLIC_`.
- [ ] **Script Tag External:** Script AdSense atau Analytics dimuat via Next.js `<Script>` dengan strategi pemuatan teroptimasi.
