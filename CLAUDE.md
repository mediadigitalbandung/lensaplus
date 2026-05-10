# CLAUDE.md — Instruksi untuk Claude Code

## Project
- **Nama:** Kartawarta v2.0 — Media Berita Digital Bandung (general news, prioritas bisnis-ekonomi, pemerintahan, hukum + topik general lain: olahraga, hiburan, teknologi, dsb.)
- **Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL, NextAuth
- **Deploy:** VPS Hostinger (Ubuntu 24.04, `145.79.15.99`, PM2 process `kartawarta`)
- **Repo:** github.com/mediadigitalbandung/kartawarta
- **URL:** https://kartawarta.com

## Feature Migration Sedang Berlangsung

Kartawarta sedang **disamakan fitur & metode-nya** dengan referensi di [docs/FEATURE_REFERENCE.md](docs/FEATURE_REFERENCE.md) (dokumen master diambil dari jurnalishukumbandung.com, disetujui user tgl 2026-04-24).

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

**CATATAN:** Palet dulu "GoTo Green" (`#00AA13`). Sudah di-rebrand ke navy dalam ("Editorial Authority") — cek [tailwind.config.ts](tailwind.config.ts) untuk nilai autoritatif.

### Warna (Light Mode)
- **Primary (Navy):** `#002045` — tombol, badge, link, aksen utama, header
- **Primary Dark:** `#001530` — hover state
- **Primary Light:** `#e8edf3` — badge background, highlight
- **Secondary (Crimson):** `#b7102a` — tombol urgent, badge LIVE, ikon aksen
- **Secondary Dark:** `#8f0c20` — hover
- **Secondary Light:** `#fce8eb` — badge correction
- **Tertiary (Coklat):** `#371800` — badge opini
- **Surface:** `#f8f9fa` (default), `#ffffff` (lowest), `#f1f3f4` (low), `#e8eaeb` (container), `#dcdfe0` (high), `#002045` (dark)
- **On-surface:** `#191c1d` (text primary), `#44474e` (variant/secondary), `#74777f` (muted)
- **Border:** `#c4c6d0` base dengan alpha variant
- **Alias legacy:** `goto.green` sekarang → `#002045` (migration helper, jangan diandalkan)

### Typography
- **Serif (body & headline):** Newsreader — `font-serif`, CSS var `--font-newsreader`
- **Sans (UI):** Work Sans — `font-sans`, CSS var `--font-work-sans`
- **Type scale eksplisit:** `display-lg/md/sm`, `headline-lg/md/sm`, `title-lg/md/sm`, `body-lg/md/sm`, `label-lg/md/sm` — ada leading/tracking/weight di tailwind.config.ts

### Layout Style
- Horizontal scroll carousels untuk konten di homepage
- Hero carousel + headline slider (auto-rotate 5 artikel)
- Section headers: judul kiri + "Lihat Semua" kanan (primary)
- Clean cards `rounded-sm`, subtle `shadow-card` → `shadow-card-hover` on hover
- Tombol `rounded-md` (bukan full — berubah dari GoTo style)
- Content-centric, minimal chrome

### Komponen CSS Utility (`src/app/globals.css`)
- `.container-main` — `max-w-6xl` centered (`px-5 sm:px-8`)
- `.section-header` / `.section-title` / `.section-subtitle` / `.section-link`
- `.card` — `rounded-sm`, `bg-surface-container-lowest`, hover `shadow-ambient` + `-translate-y-0.5`
- `.card-breaking` — border-left crimson
- `.btn-primary` — `rounded-md`, `bg-primary`, `text-on-primary`
- `.btn-secondary` / `.btn-ghost` / `.btn-urgent` (crimson) / `.btn-outline-green` (primary outline) / `.btn-tertiary`
- `.badge` / `.badge-green` (primary tint) / `.badge-live` (crimson) / `.badge-verified` / `.badge-unverified` (yellow) / `.badge-opinion` (tertiary) / `.badge-correction` (secondary)
- `.input` — no-border, surface shift on focus
- `.article-content` — typography artikel (h2/h3/p/blockquote/table)

## Database

- **Provider:** PostgreSQL 16 (self-hosted di VPS 145.79.15.99)
- **Host:** `localhost:5432` (aplikasi jalan di VPS yang sama)
- **Database:** `kartawarta` (user: `kartawarta`)
- **Schema:** [prisma/schema.prisma](prisma/schema.prisma) — saat ini 18 model, target 27 (lihat `docs/FEATURE_REFERENCE.md` section 10 untuk model yang perlu ditambah)
- **Migrate:** `npx prisma db push` (bukan `migrate dev`)
- **Env:** `DATABASE_URL="postgresql://kartawarta:<password>@localhost:5432/kartawarta"` (pakai juga `DIRECT_URL` kalau pakai pooler)

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
- Env vars produksi dikelola langsung di `/var/www/kartawarta/.env` di VPS (lihat `deploy-vps.sh`)
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

Cara kerja `migration-lead`: saat user bilang **"lanjut"** / **"lanjutkan migrasi"**, dia baca `MIGRATION_PROGRESS.md`, pick task `[ ]` pertama yang dependensinya sudah `[x]`, delegasi ke specialist yang tepat, validasi hasil, update ke `[x]`, lanjut task berikutnya. User hanya dipanggil kalau butuh input (API key, breaking change confirm) atau fase selesai.
