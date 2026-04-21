# CLAUDE.md - Instruksi untuk Claude Code

## Project
- **Nama:** Kartawarta v2.0
- **Stack:** Next.js 14, TypeScript, Tailwind CSS, Prisma, PostgreSQL, NextAuth
- **Deploy:** VPS Hostinger (Ubuntu 24.04, 145.79.15.99)
- **Repo:** github.com/mediadigitalbandung/kartawarta
- **URL:** https://kartawarta.com

## Workflow: Auto Commit, Push & Deploy

**PENTING:** Setiap kali selesai melakukan perubahan kode, WAJIB langsung:

1. **Build** — `npx next build` untuk pastikan tidak ada error
2. **Stage** — `git add` file yang berubah (jangan pakai `git add -A` jika ada `.env`)
3. **Commit** — dengan pesan deskriptif dalam bahasa Inggris, format:
   - `feat:` untuk fitur baru
   - `fix:` untuk bug fix
   - `style:` untuk perubahan UI/styling
   - `refactor:` untuk refactoring
   - `docs:` untuk dokumentasi
   - Akhiri dengan `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
4. **Push** — `git push origin master`
5. **Verifikasi** — cek HTTP status dari URL production (curl)

Jangan tunggu user minta commit/push — **langsung lakukan** setelah perubahan selesai dan build sukses.

## Design System

### Warna (Light Mode — GoTo-inspired)
- **Brand (GoTo Green):** `#00AA13` — tombol, badge, link, aksen utama
- **Brand Dark:** `#008C10` — hover state
- **Brand Light:** `#E6F9E8` — badge background, highlight
- **Surface:** `#FFFFFF` (primary), `#F7F7F8` (secondary), `#F0F1F3` (tertiary), `#1C1C1E` (dark)
- **Text:** `#1C1C1E` (primary), `#6B7280` (secondary), `#9CA3AF` (muted), `#FFFFFF` (inverse)
- **Border:** `#E5E7EB` (default), `#F3F4F6` (light)
- **LIGHT MODE** — warna terang, clean, profesional

### Layout Style
- Horizontal scroll carousels untuk konten di homepage
- Full-width hero banner + headline slider
- Section headers: judul kiri + "Lihat Semua" kanan (green)
- Clean white cards dengan rounded-[12px], subtle shadow-card
- GoTo-style rounded buttons (rounded-full)
- Content-centric, minimal chrome

### Komponen CSS Utility
- `.container-main` — max-w-6xl centered (px-5 sm:px-8)
- `.section-header` / `.section-title` / `.section-link`
- `.card` — rounded-[12px], bg-surface, border, shadow-card, hover elevation
- `.btn-primary` — rounded-full, bg-goto-green
- `.btn-secondary` / `.btn-ghost`
- `.badge` / `.badge-green` / `.badge-live` / `.badge-verified`
- `.input`

## Database

- **Provider:** PostgreSQL (self-hosted di VPS Hostinger 145.79.15.99)
- **Host:** `localhost:5432` (dari sisi aplikasi yang jalan di VPS yang sama)
- **Database:** `kartawarta` (user: `kartawarta`)
- **Schema:** `prisma/schema.prisma`
- **Migrate:** `npx prisma db push`
- **Env:** `DATABASE_URL="postgresql://kartawarta:<password>@localhost:5432/kartawarta"`

## File Penting

```
prisma/schema.prisma    — Database schema
src/app/page.tsx        — Homepage
src/app/layout.tsx      — Root layout
src/app/globals.css     — Global styles + utilities
tailwind.config.ts      — Tailwind color system
src/lib/auth.ts         — NextAuth config
src/lib/prisma.ts       — Prisma client singleton
src/lib/api-utils.ts    — API helpers (auth, error handling)
src/components/layout/  — Header, Footer, Sidebar, NewsTicker
src/components/artikel/ — ArticleCard, CopyProtection
src/app/api/            — All API routes
src/app/panel/          — Admin panel pages
```

## Aturan Kode

- Semua halaman publik query langsung via Prisma (server components)
- Panel admin pakai client components + fetch API routes
- Gunakan `export const dynamic = "force-dynamic"` untuk halaman yang query database
- Jangan commit file `.env` — sudah di `.gitignore`
- Env vars produksi dikelola langsung di `/var/www/kartawarta/.env` di VPS (lihat `deploy-vps.sh`)
- Password di-hash dengan `bcryptjs` (12 rounds)
