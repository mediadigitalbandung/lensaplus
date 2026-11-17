# CLAUDE.md — Instruksi untuk Claude Code

## Project
- **Nama:** Lensaplus v2.0 — Media Berita Digital Bandung (general news, prioritas bisnis-ekonomi, pemerintahan, hukum + topik general lain: olahraga, hiburan, teknologi, dsb.)
- **Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL, NextAuth
- **Deploy:** VPS Hostinger (Ubuntu 24.04, `145.79.15.99`, PM2 process `lensaplus`)
- **Repo:** github.com/mediadigitalbandung/lensaplus
- **URL:** https://lensaplus.com

## Feature Migration Sedang Berlangsung

Lensaplus sedang **disamakan fitur & metode-nya** dengan referensi di [docs/FEATURE_REFERENCE.md](docs/FEATURE_REFERENCE.md) (dokumen master diambil dari jurnalishukumbandung.com, disetujui user tgl 2026-04-24).

- **Progress tracker:** [docs/MIGRATION_PROGRESS.md](docs/MIGRATION_PROGRESS.md) — sumber kebenaran tunggal, dibaca & ditulis ulang oleh `migration-lead` agent tiap sesi.
- **Orchestrator:** `migration-lead` (di `.claude/agents/`). Saat user bilang "lanjut" / "lanjutkan migrasi" / "kerjakan migrasi" → invoke agent ini. Dia pick task `[ ]` berikutnya, delegasi ke specialist, update progress.
- **Specialist baru:** `ai-client-builder`, `seo-distributor`, `social-publisher`, `social-template-renderer`, `analytics-connector`, `cloudflare-ops`, `cron-engineer`, `integration-secrets-ui`, `doc-panel-builder`.
- **Specialist existing** yang dipakai: `database-architect` (schema), `api-dev` (routes), `frontend-dev` (UI), `auth-guardian`, `build-test-validator`, `security-auditor`, `git-release-specialist`.

**Prinsip:** User tidak perlu menyuruh-nyuruh detail. Begitu bilang "lanjut", orchestrator jalan mandiri sampai ketemu blocker yang butuh keputusan/API key user.

## Workflow: Auto Commit, Push & Deploy

**PENTING:** Setiap kali selesai melakukan perubahan kode, WAJIB langsung:

1. **Build** — `npx next build` untuk pastikan tidak ada error
2. **Stage** — `git add` file yang berubah (jangan pakai `git add -A` jika ada `.env`)
3. **Commit** — dengan pesan deskriptif dalam bahasa Inggris, format:
   - `feat:` fitur baru | `fix:` bug fix | `style:` UI/styling | `refactor:` | `docs:` | `chore:`
   - Akhiri dengan `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
4. **Push** — `git push origin master`
5. **Verifikasi** — cek HTTP status dari URL production (curl)

Jangan tunggu user minta commit/push — **langsung lakukan** setelah perubahan selesai dan build sukses. Untuk rilis kompleks, delegasi ke `release-lead`.

## Design System — "Editorial Authority"

> **SOP Desain Wajib:** Baca dan patuhi **[docs/DESIGN_SOP.md](docs/DESIGN_SOP.md)** sebelum membuat atau mengubah antarmuka apa pun:
> 1. **Zero Icon Boxes** — Dilarang membungkus icon dengan background lingkaran atau persegi.
> 2. **Minimal Icons** — Gunakan icon hanya bila fungsional (jangan di heading, timestamp, atau setiap kategori/kartu).
> 3. **Zero Text Highlight Background** — Dilarang memberi background warna highlight/pastel di belakang teks label, kategori, tag, status, atau link; gunakan tipografi bersih, `border-l-4`, atau border netral tipis.

**CATATAN:** Palet & type scale autoritatif didefinisikan di [tailwind.config.ts](tailwind.config.ts) dan [src/app/globals.css](src/app/globals.css).

### Warna & Tipografi
- Sumber token warna (`primary`, `secondary`, `tertiary`, `surface`, `on-surface`, `border`) & type scale: **[tailwind.config.ts](tailwind.config.ts)**.
- Font heading/editorial: `font-serif` (`Plus Jakarta Sans`) · Font body/UI: `font-sans` (`Inter`).
- Detail aturan visual (Zero Icon Boxes, Minimal Icons, Zero Text Highlight Background): **[docs/DESIGN_SOP.md](docs/DESIGN_SOP.md)**.

### Komponen CSS Utility (`src/app/globals.css`)
- `.container-main` — `max-w-6xl` centered (`px-5 sm:px-8`)
- `.section-header` / `.section-title` / `.section-subtitle` / `.section-link`
- `.card` / `.card-breaking`
- `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-urgent` / `.btn-outline-green` / `.btn-tertiary`
- `.badge` / `.badge-green` / `.badge-live` / `.badge-verified` / `.badge-unverified` / `.badge-opinion` / `.badge-correction` — label tipografi bersih tanpa background highlight warna
- `.input` — form input bersih
- `.article-content` — typography artikel (h2/h3/p/blockquote/table) & `.baca-juga-list` (border-left aksen tanpa highlight warna)

## Database

- **Provider:** PostgreSQL 16 (self-hosted di VPS 145.79.15.99)
- **Host:** `localhost:5432` (aplikasi jalan di VPS yang sama)
- **Database:** `lensaplus` (user: `lensaplus`)
- **Schema:** [prisma/schema.prisma](prisma/schema.prisma) — saat ini 18 model, target 27 (lihat `docs/FEATURE_REFERENCE.md` section 10 untuk model yang perlu ditambah)
- **Migrate:** `npx prisma db push` (bukan `migrate dev`)
- **Env:** `DATABASE_URL="postgresql://lensaplus:<password>@localhost:5432/lensaplus"` (pakai juga `DIRECT_URL` kalau pakai pooler)

### Role Hierarchy (6 level)
`SUPER_ADMIN > CHIEF_EDITOR > EDITOR > SENIOR_JOURNALIST > JOURNALIST > CONTRIBUTOR`

Helper di [src/lib/auth.ts](src/lib/auth.ts): `canPublishDirectly`, `canApproveArticles`, `canWriteArticles`, `canManageUsers`, `canManageAds`.

### Workflow Artikel
`DRAFT → IN_REVIEW → (APPROVED → PUBLISHED) | (REJECTED → DRAFT) → ARCHIVED`. Enforcement state-machine di [src/app/api/articles/[id]/route.ts](src/app/api/articles/[id]/route.ts).

## File Penting

```
prisma/schema.prisma            — Database schema (target 27 model)
src/app/page.tsx                — Homepage (ISR revalidate 60s)
src/app/layout.tsx              — Root layout + metadata + PWA
src/app/globals.css             — Utility classes + print styles
tailwind.config.ts              — Color system + type scale
src/middleware.ts               — Auth guard untuk /panel/*
src/lib/auth.ts                 — NextAuth JWT + role helpers
src/lib/prisma.ts               — Client singleton
src/lib/api-utils.ts            — requireAuth/requireRole/errorResponse/logAudit
src/lib/ai-client.ts            — (TARGET) Claude + DeepSeek fallback
src/lib/seo-auto.ts             — onArticlePublished (expand dengan Indexing + IndexNow + Social + CF)
src/lib/social/                 — (TARGET) Meta Graph + templates
src/lib/stats/                  — (TARGET) GA4 + GSC + CF analytics
src/lib/seo/                    — (TARGET) Google Indexing, IndexNow, Sorotan, JSON-LD
src/lib/cloudflare/             — (TARGET) cache purge
src/components/layout/          — Header, Footer, Sidebar, NewsTicker, PublicNav/Footer
src/components/artikel/         — ArticleCard, CommentSection, BookmarkButton, ShareBar
src/components/editor/          — RichTextEditor (TipTap), ImageUploader, (TARGET) ImageCropModal
src/components/slider/          — HeroCarousel, HeadlineSlider, PollingCarousel, dll
src/app/api/                    — All API routes (saat ini ~40, target 75+)
src/app/panel/                  — Admin panel (target: +auto-artikel, +social, +sorotan, +statistik, +jadwal-sidang, +dokumentasi)
docs/FEATURE_REFERENCE.md       — Spec fitur target
docs/MIGRATION_PROGRESS.md      — Progress tracker migrasi
.claude/agents/                 — Agent system (28 agent: 18 core + 10 migration)
```

## Aturan Kode

- Semua halaman publik query langsung via Prisma (server components)
- Panel admin pakai client components + fetch API routes
- Gunakan `export const dynamic = "force-dynamic"` untuk halaman yang query DB + butuh fresh data
- Jangan commit file `.env` — sudah di `.gitignore`
- Env vars produksi dikelola langsung di `/var/www/lensaplus/.env` di VPS (lihat `deploy-vps.sh`)
- Password di-hash dengan `bcryptjs` (12 rounds)
- Sanitize HTML input artikel via `src/lib/sanitize.ts` saat POST/PUT
- Rate limit endpoint publik (comment, poll vote, report, contact) via `src/lib/rate-limit.ts`
- Semua API mutasi tulis ke `AuditLog` via `logAudit()`
- API keys external disimpan di `SystemSetting` DB (hanya SUPER_ADMIN read/write), **bukan** di env

## Agent System (28 agent)

Detail di [.claude/agents/README.md](.claude/agents/README.md). Orchestrator utama:
- `tech-lead` — coding multi-layer
- `editorial-lead` — produksi artikel end-to-end
- `release-lead` — pipeline build+deploy
- `migration-lead` — eksekusi migrasi fitur sesuai `docs/FEATURE_REFERENCE.md`
- `tiktok-lead` — otomasi TikTok sesuai `docs/TIKTOK_AUTOMATION.md` (delegasi ke `tiktok-render-engineer` Fase 2 + `tiktok-publish-engineer` Fase 3). Panggil saat user bilang **"lanjut tiktok"** / **"lanjut tiktok fase 2/3"**.

Cara kerja `migration-lead`: saat user bilang **"lanjut"** / **"lanjutkan migrasi"**, dia baca `MIGRATION_PROGRESS.md`, pick task `[ ]` pertama yang dependensinya sudah `[x]`, delegasi ke specialist yang tepat, validasi hasil, update ke `[x]`, lanjut task berikutnya. User hanya dipanggil kalau butuh input (API key, breaking change confirm) atau fase selesai.
