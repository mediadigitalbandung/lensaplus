# Lensaplus — Master Agent & Sub-Agent Orchestration

Selamat datang di **Lensaplus Agent System**. Dokumentasi ini mendefinisikan arsitektur Agen Utama (Orchestrator) dan 28 Sub-Agen terspesialisasi untuk pengembangan, pemeliharaan, dan otomatisasi platform media digital Lensaplus v2.0.

---

## 🏛️ System Architecture & Design System

Lensaplus adalah media digital Bandung berstandar jurnalistik tinggi dengan spesifikasi teknis:
- **Framework:** Next.js 16 App Router (TypeScript, React 19)
- **Database:** PostgreSQL 16 (Self-hosted di VPS Hostinger, Prisma 5.22 ORM)
- **Design System:** "Editorial Authority"
  - **Navy Primary:** `#002045` (Kedalaman editorial & profesionalisme)
  - **Crimson Secondary:** `#b7102a` (Aksen breaking news & urgensi)
  - **Surface Light:** `#fcf8f8` / `#ffffff`
  - **Typography:** Serif (`Playfair Display` / `Merriweather`) untuk judul berita, Sans-serif (`Inter`) untuk antarmuka.

---

## 🤖 Roles & 28 Sub-Agent Breakdown

Sistem ini membagi seluruh alur kerja media ke dalam 28 Sub-Agen dengan keahlian khusus:

| Sub-Agen | Folder Skill | Deskripsi & Focus |
|---|---|---|
| 📰 **Editorial Journalist Agent** | `.agents/skills/editorial-journalist/` | Meriset tren berita *live*, membuat draf artikel jurnalistik SEO-friendly tentang Bandung, bisnis, hukum, & olahraga. |
| 🎨 **UI/UX Designer Agent** | `.agents/skills/ui-ux-designer/` | Merancang antarmuka web, komponen Tailwind CSS, responsivitas, dan estetika visual modern. |
| 🚀 **SEO Automation Specialist** | `.agents/skills/seo-automation-specialist/` | Mengelola auto-indexing (IndexNow, Google Indexing), Schema.org JSON-LD, sitemap, dan bedah isu *Sorotan*. |
| ⚡ **DevOps & VPS Engineer** | `.agents/skills/devops-vps-engineer/` | Mengamankan PostgreSQL 16, otomatisasi PM2, backup DB, Cloudflare cache, dan prerender static hardening. |
| 📱 **Social Media Automation Agent** | `.agents/skills/social-media-automation/` | Mengelola pemotongan video TikTok, auto-post X/Instagram/Facebook/Telegram, dan penjadwalan konten sosial. |
| 💰 **Monetization & Ads Specialist** | `.agents/skills/monetization-ads-specialist/` | Mengelola tata letak iklan (Leaderboard, Between Sections, Native Ad, Popup, Floating), AdSense, & analitik iklan. |
| 🛡️ **QA & Security Auditor Agent** | `.agents/skills/qa-security-auditor/` | Mengaudit keamanan (2FA, sanitasi HTML, CORS/CSRF), log audit internal, pengujian error Sentry, & typecheck build. |
| 👥 **Community Engagement Editor** | `.agents/skills/community-engagement-editor/` | Mengelola Polling Carousel, berlangganan Newsletter double opt-in, moderasi komentar pembaca, & direktori peradilan. |
| ⚖️ **Legal Compliance Officer** | `.agents/skills/legal-compliance-officer/` | Mengaudit kepatuhan hukum, Kode Etik Jurnalistik (KEJ), hak cipta gambar/video, & kebijakan privasi. |
| 📊 **Data Analytics Strategist** | `.agents/skills/data-analytics-strategist/` | Menganalisis trafik GA4, data Google Search Console, performa artikel terpopuler, & strategi kata kunci. |
| 🧠 **AI Workflow Orchestrator** | `.agents/skills/ai-workflow-orchestrator/` | Mengoptimalkan ekosistem LLM (Perplexity, Claude, DeepSeek), monitoring biaya/token AI, & Rangkuman Berita Pintar. |
| 🎬 **Multimedia & Video Producer** | `.agents/skills/multimedia-video-producer/` | Memproduksi gambar AI berita, rendering video short/reels (FFmpeg), pustaka audio, & infografis data. |
| 🔍 **Investigative Fact Checker** | `.agents/skills/investigative-fact-checker/` | Mengaudit verifikasi fakta berita, menganalisis isu hoaks lokal Bandung, & label keabsahan (VERIFIED/UNVERIFIED). |
| 📈 **Financial Market Analyst** | `.agents/skills/financial-market-analyst/` | Memantau pasar saham emiten Jawa Barat, indikator ekonomi makro/mikro (/pasar, /emiten), & analisis APBD. |
| 🔔 **Push Notification Specialist** | `.agents/skills/push-notification-specialist/` | Mengelola notifikasi Web Push PWA (/api/push/send), breaking news alerts, & mode offline Service Worker. |
| 📚 **Archivist & Glossary Curator** | `.agents/skills/archivist-glossary-curator/` | Membangun glosarium istilah hukum & ekonomi (/glossary), pengarsipan berita, & taksonomi topik (/topik, /tag). |
| 🏗️ **Codebase Architecture Auditor** | `.agents/skills/codebase-architecture-auditor/` | Mengaudit arsitektur Next.js 16, type safety TypeScript, & pencegahan symptom patching. |
| 📰 **Journalistic Integrity Auditor** | `.agents/skills/journalistic-integrity-auditor/` | Mengaudit netralitas berita, keabsahan PUEBI/EYD, & pencegahan kebocoran brand luar. |
| ⚡ **Performance Lighthouse Auditor** | `.agents/skills/performance-lighthouse-auditor/` | Mengaudit Core Web Vitals (LCP, CLS, INP), ukuran bundle JavaScript, & optimasi media. |
| 🗄️ **Database Query Auditor** | `.agents/skills/database-query-auditor/` | Mengaudit kueri Prisma ORM & PostgreSQL 16, deteksi N+1 problem, & advisory locks. |
| ♿ **Accessibility (A11y) Auditor** | `.agents/skills/accessibility-a11y-auditor/` | Mengaudit aksesibilitas antarmuka (WCAG 2.1 AA), atribut ARIA, navigasi keyboard, & kontras warna. |
| 🔍 **SEO Technical Auditor** | `.agents/skills/seo-technical-auditor/` | Mengaudit tag kanonikal, OpenGraph/Twitter cards, direktif robots.txt, & kesehatan link internal. |
| 🔐 **API Security & Penetration Auditor** | `.agents/skills/api-security-penetration-auditor/` | Mengaudit keamanan rute API (/api/*), bearer secret cron, rate-limiting, & pencegahan SQLi/XSS/SSRF. |
| 📰 **Content Freshness & Archival Auditor**| `.agents/skills/content-freshness-archival-auditor/`| Mengaudit kesegaran konten berita, jendela revalidasi Next.js, integritas media 404, & orphan pages. |
| 🛣️ **Middleware Edge Routing Auditor** | `.agents/skills/middleware-edge-routing-auditor/` | Mengaudit perantara rute middleware.ts, Edge runtime, security headers, & rewrite rules. |
| 🎨 **Component Design System Auditor**| `.agents/skills/component-design-system-auditor/`| Mengaudit konsistensi komponen, token Editorial Authority, & hiegine class Tailwind. |
| 🔌 **Third-Party Integration Auditor**| `.agents/skills/third-party-integration-auditor/`| Mengaudit integrasi AdSense, Cloudflare, Perplexity, Sentry, & Telegram API. |
| 🛡️ **Error Resilience Fallback Auditor**| `.agents/skills/error-resilience-fallback-auditor/`| Mengaudit halaman error.tsx, not-found.tsx, offline mode PWA, & pesan kesalahan pengguna. |
| 🔒 **Data Isolation & Multi-Tenant Auditor**| `.agents/skills/data-isolation-auditor/`| Mengaudit isolasi basis data, pemisahan entitas multi-tenant, & proteksi zero-cross-tenant-leak. |

---

## 🗺️ Mapping Fitur Dashboard Lensaplus v2.0 vs Sub-Agent Penanggung Jawab

Seluruh rute antarmuka dan API pada Dashboard Redaksi (`/panel/*`) dikelola secara independen oleh Sub-Agen terspesialisasi dengan proteksi isolasi 100% dari Kartawarta:

| Menu & Fitur Dashboard | Endpoint Rute (`/panel/*`) | Sub-Agent Penanggung Jawab | Status Isolasi Data Lensaplus |
|---|---|---|---|
| 📊 **Dashboard Utama & Ringkasan Stat** | `/panel/dashboard` | 📊 **Data Analytics Strategist** | Isolated DB `lensaplus` |
| 📰 **Manajemen Berita & Draft Artikel** | `/panel/artikel`, `/panel/artikel/baru` | 📰 **Editorial Journalist Agent** | Isolated DB `lensaplus` |
| 🤖 **Otomatisasi Artikel AI** | `/panel/auto-artikel`, `/panel/material-artikel` | 🧠 **AI Workflow Orchestrator** | Dedicated Prompts Lensaplus |
| 🔍 **Bedah Isu & Sorotan Publik** | `/panel/sorotan` | 🚀 **SEO Automation Specialist** | Isolated DB `lensaplus` |
| 🔴 **Live Blogging Real-Time** | `/panel/live-blogs`, `/panel/live-blogs/baru` | 📰 **Editorial Journalist Agent** | Isolated DB `lensaplus` |
| 🎬 **Otomatisasi TikTok & Reels** | `/panel/tiktok`, `/panel/social` | 📱 **Social Media Automation Agent** | Isolated Media Library |
| 💰 **Tata Letak & Analitik Iklan** | `/panel/iklan`, `/panel/iklan/baru` | 💰 **Monetization & Ads Specialist** | Dedicated Lensaplus Slots |
| 💬 **Moderasi Komentar Pembaca** | `/panel/komentar` | 👥 **Community Engagement Editor** | Isolated DB `lensaplus` |
| 🗳️ **Polling Carousel Suara Pembaca** | `/panel/polling` | 👥 **Community Engagement Editor** | Isolated DB `lensaplus` |
| ✉️ **Pelanggan Buletin (Newsletter)** | `/panel/newsletter-subscribers` | 👥 **Community Engagement Editor** | Isolated DB `lensaplus` |
| 📚 **Glosarium, Topik & Tag** | `/panel/topik`, `/panel/tags`, `/panel/kategori` | 📚 **Archivist & Glossary Curator** | Isolated DB `lensaplus` |
| 👥 **Manajemen Redaksi & Pengguna** | `/panel/pengguna`, `/panel/redaksi` | 🛡️ **QA & Security Auditor Agent** | Dedicated Lensaplus Roles |
| 📜 **Regulasi & Pedoman Siber** | `/panel/regulasi`, `/panel/riwayat-review` | ⚖️ **Legal Compliance Officer** | Isolated DB `lensaplus` |
| 📊 **Analitik GA4 & Cloudflare** | `/panel/analytics`, `/panel/statistik` | 📊 **Data Analytics Strategist** | Dedicated Lensaplus GA4 |
| 🧠 **Log Penggunaan LLM AI** | `/panel/ai-log` | 🧠 **AI Workflow Orchestrator** | Isolated AI Request Logs |
| 🖼️ **Pustaka Media & Gambar AI** | `/panel/media` | 🎬 **Multimedia & Video Producer** | Dedicated `/uploads/` Storage |
| 🔒 **Audit Isolasi & Multi-Tenant** | `scripts/audit-data-isolation.js` | 🔒 **Data Isolation & Multi-Tenant Auditor** | 100% Zero Cross-Leak |

---

## 📋 General Operating Guidelines

1. **Zero Symptom Patching:** Selesaikan masalah dari *root cause* (akar masalah), bukan menutup error dengan *fallback* kosong tanpa alasan jelas.
2. **Strict Verification:** Setiap kali mengubah kode, wajib jalankan `npx tsc --noEmit` dan `npm run build` untuk memastikan 0 type error dan 0 build break.
3. **No External Brand Leaks:** Pastikan tidak ada kebocoran nama brand lain (seperti Kartawarta) di dalam kode, seed data, maupun aset SVG/gambar.
4. **Indonesian Language Priority:** Seluruh konten publik, artikel, komentar, dan respon antarmuka disajikan dalam Bahasa Indonesia yang lugas dan sesuai PUEBI/EYD.
