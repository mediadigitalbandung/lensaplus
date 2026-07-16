# Lensaplus v2.0 — Audit Report Menyeluruh

> **Tanggal audit:** 2026-05-07 → 2026-05-08
> **Mode:** Full audit (18 dimensi · 14 sub-auditor)
> **Trigger:** User minta "audit menyeluruh, kepala audit" pasca migrasi 13/13 fase
> **Orchestrator:** `audit-lead` (newly built)
> **Status:** ❌ **BLOCK RELEASE** — 1 CRITICAL stored-XSS regression + 2 CRITICAL DR gap + 2 CRITICAL integration silent-fail.

## Executive Summary

| Severity | Count | Note |
|---|---|---|
| 🔴 **CRITICAL** | **16** | Termasuk 1 regression Phase 12 H-1 (Article PUT tetap unsanitized), 2 backup gaps, 2 integration silent-fail, 4 a11y form-label, 2 perf DoS, 3 design blocker, 2 cron secret-resolution. |
| 🟠 **HIGH** | **44** | Sebagian besar bisa scheduled 1 sprint (dep CVE, perf force-dynamic mass, AuditLog gap 55%, SSRF scraper, RBAC panel/iklan no guard). |
| 🟡 **MEDIUM** | **52** | Best-practice tightening (FK cascade, retention crons, JSON-LD gaps, retry classifier, hardcode role string). |
| ⚪ **LOW** | **31** | Cosmetic + future-proof (404 vs 500 mapping, stale enum FAQ, lint img→Image, dead column). |
| ℹ️ **INFO** | **8** | Observasi yang tidak butuh fix. |

**Total findings: 151 lintas 14 auditor.**

## Per-Dimensi Verdict

| # | Dimensi | Auditor | 🔴 | 🟠 | 🟡 | ⚪ | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | Security (OWASP/secret/XSS/SQLi/SSRF) | security-auditor | 0 | 3 | 5 | 4 | ⚠️ FIX REKOM |
| 2 | Auth & RBAC coverage | auth-guardian | 0 | 3 | 4 | 1 | ⚠️ FIX REKOM |
| 3 | Build & TypeScript | build-test-validator | 0 | 0 | 0 | 0 | ✅ OK |
| 4 | Test coverage | build-test-validator | 0 | 0 | 1 | 0 | ⚠️ GAP |
| 5 | Database schema/index/query | db-auditor | 0 | 2 | 6 | 4 | ⚠️ FIX REKOM |
| 6 | Backup & DR | backup-dr-auditor | **2** | 3 | 4 | 4 | ❌ **BLOCK** |
| 7 | Privacy & UU PDP | privacy-compliance-auditor | 0 | 4 | 7 | 3 | ⚠️ FIX REKOM |
| 8 | Performance | perf-auditor | **2** | 5 | 5 | 2 | ❌ **BLOCK** |
| 9 | SEO infra | seo-auditor | 0 | 2 | 5 | 4 | ⚠️ FIX REKOM |
| 10 | Accessibility (WCAG 2.1 AA) | a11y-auditor | **4** | 5 | 5 | 3 | ❌ **BLOCK** |
| 11 | API design consistency | api-design-auditor | **2** | 5 | 5 | 4 | ❌ **BLOCK** |
| 12 | Cron jobs | observability-auditor | 0 | 2 | 3 | 0 | ⚠️ FIX REKOM |
| 13 | External integrations | integration-health-auditor | **2** | 4 | 5 | 4 | ❌ **BLOCK** |
| 14 | Observability (Sentry+AuditLog) | observability-auditor | 0 | 3 | 4 | 2 | ⚠️ FIX REKOM |
| 15 | Design system | design-guardian | **3** | 4 | 4 | 3 | ❌ **BLOCK** |
| 16 | Content safety (sanitize) | content-safety-auditor | **1** | 2 | 3 | 2 | ❌ **BLOCK** |
| 17 | Editorial workflow | content-safety-auditor | 0 | 0 | 0 | 0 | ✅ OK |
| 18 | Dependencies | dep-auditor | 0 | 5 | 4 | 3 | ⚠️ FIX REKOM |

## 🔴 CRITICAL — 16 Temuan (Block Release)

### CRIT-01 · [Content Safety] Article PUT NEVER sanitize content — Phase 12 H-1 regression
- **File:** `src/app/api/articles/[id]/route.ts:196-221, 313-336, 542-556, 745, 769-778`
- **Detail:** POST `/api/articles` benar memanggil `sanitizeHtml(data.content)` (route.ts:223), tetapi PUT `[id]/route.ts` TIDAK ada call sanitize di SEMUA 4 cabang (jurnalis self-edit, editor edit, admin edit, admin publish). Stored XSS via TipTap editor atau API.
- **Impact:** Setiap journalist authenticated bisa inject `<script>` yang ter-render di `/berita/[slug]`. **Phase 12 H-1 fix tidak benar-benar diterapkan ke PUT path.**
- **Fix:** Tambah `if (data.content) data.content = sanitizeHtml(data.content);` setelah `updateArticleSchema.parse` (~line 111).
- **Delegasi:** `api-dev`

### CRIT-02 · [Content Safety] Revisions panel render unsanitized
- **File:** `src/app/panel/artikel/[id]/revisions/page.tsx:544`
- **Detail:** `dangerouslySetInnerHTML={{ __html: rev.content }}` tanpa sanitize. Revision row carry payload tertanam dari pre-CRIT-01 era.
- **Impact:** Stored XSS targeting editors → escalate JOURNALIST → admin session.
- **Fix:** Sanitize server-side atau DOMPurify client-side sebelum render.
- **Delegasi:** `frontend-dev`

### CRIT-03 · [Perf] /api/users tanpa pagination — DoS
- **File:** `src/app/api/users/route.ts:16-29`
- **Detail:** `prisma.user.findMany()` tanpa `take`/`skip`. Saat user growth, satu request bisa serialize seluruh tabel.
- **Impact:** Response payload puluhan MB, memory pressure, browser parsing time.
- **Fix:** Enforce `take=50` default, `Math.min(100, ...)`.
- **Delegasi:** `api-dev`

### CRIT-04 · [Perf] /api/ai/bulk-tags triple-nested DB calls
- **File:** `src/app/api/ai/bulk-tags/route.ts:20-117`
- **Detail:** `findMany articles → for article → for tagName → upsert + findUnique + update`. 10 articles × 8 tags = 240+ queries serial.
- **Impact:** Connection pool exhaustion, timeout risk.
- **Fix:** Batch `createMany skipDuplicates` + collapse ke 1-2 update calls.
- **Delegasi:** `api-dev`

### CRIT-05 · [a11y] Form labels tanpa `htmlFor` — coverage 1% (3 / 248 inputs)
- **File:** `src/app/kontak/page.tsx:104,108,113,125`; `src/app/panel/artikel/baru/page.tsx:532,546,567,587,608,629,645`; lintas semua panel form (login, redaksi, polling, topik, kategori).
- **Detail:** 245 input/select/textarea visible-label tapi tidak terikat ke control via `htmlFor`. Screen reader gagal pair label-control.
- **Impact:** WCAG 1.3.1 Info & Relationships, 4.1.2 Name/Role/Value violation. UU PDP form sensitif (kontak) tidak accessible.
- **Fix:** Tambah `htmlFor` + matching `id` di setiap input.
- **Delegasi:** `frontend-dev`

### CRIT-06 · [a11y] PrintButton modal tanpa dialog semantics + focus trap
- **File:** `src/components/artikel/PrintButton.tsx:39-40`
- **Detail:** `<div onClick>` backdrop, no `role="dialog"`, no `aria-modal`, no focus-trap, no ESC handler. Tidak bisa di-dismiss via keyboard.
- **Impact:** WCAG 2.1.2 No keyboard trap, 4.1.2.
- **Fix:** Pakai pattern `ConfirmDialog` (sudah benar di codebase).
- **Delegasi:** `frontend-dev`

### CRIT-07 · [a11y] AdPreviewOverlay modal tanpa dialog semantics
- **File:** `src/app/panel/iklan/_components/AdPreviewOverlay.tsx:61-62`
- **Detail:** Identik CRIT-06.
- **Fix:** Sama dengan CRIT-06.
- **Delegasi:** `frontend-dev`

### CRIT-08 · [a11y] Auto-rotating widgets tanpa prefers-reduced-motion guard
- **File:** `src/components/slider/HeadlineSlider.tsx:52-58`, `SubHeadlineSlider.tsx:49-56`, `src/components/layout/NewsTicker.tsx:223-225,263-268`
- **Detail:** `setInterval` 5-7s + CSS marquee. WCAG 2.2.2 Pause/Stop/Hide + 2.3.3 Animation from Interactions. Vestibular trigger.
- **Impact:** Pengguna dengan disabilitas vestibular tidak bisa menonaktifkan animasi.
- **Fix:** Cek `window.matchMedia('(prefers-reduced-motion: reduce)')` + global CSS `@media (prefers-reduced-motion: reduce)` rule.
- **Delegasi:** `frontend-dev`

### CRIT-09 · [API Design] errorResponse({message, statusCode}) silent 500
- **File:** `src/app/api/reports/route.ts:79,108`, `src/app/api/setup/route.ts:23,32,45`
- **Detail:** `errorResponse()` hanya handle `ApiError` & `ZodError`. Plain object fall through → HTTP 500 dengan object stringified, bukan 404/403 yang diniatkan.
- **Impact:** Reports endpoint return 500 saat resource tidak ada, client tidak bisa membedakan missing vs server fault.
- **Fix:** Ganti dengan `throw new ApiError("...", 404)`.
- **Delegasi:** `api-dev`

### CRIT-10 · [API Design] /api/articles GET unbounded limit
- **File:** `src/app/api/articles/route.ts:46`
- **Detail:** `parseInt(searchParams.get("limit") || "12")` tanpa `Math.min`. `?limit=100000` mem-execute findMany dengan author/category/tags joins.
- **Impact:** DoS vector, response puluhan MB.
- **Fix:** `Math.min(100, Math.max(1, parseInt(...) || 12))`.
- **Delegasi:** `api-dev`

### CRIT-11 · [Integration] Meta token expiry tidak di-track / refresh / warn
- **File:** `src/lib/social/instagram.ts:74`, `facebook.ts:77`
- **Detail:** Schema punya `tokenExpiresAt` tapi (a) hanya bisa diisi manual via UI, (b) saat publish sukses tidak update, (c) tidak ada cron `/debug_token` weekly, (d) tidak ada refresh long-lived token, (e) tidak ada warning UI.
- **Impact:** Hari ke-60 silent fail di publish IG/FB error 190. Pipeline auto-publish mati tanpa user tahu.
- **Fix:** Cron mingguan: `/debug_token`, update `tokenExpiresAt`, kalau <14 hari kirim email SUPER_ADMIN + banner di `/panel/integrations`.
- **Delegasi:** `social-publisher` + `cron-engineer`

### CRIT-12 · [Integration] Resend production tidak baca SystemSetting
- **File:** `src/lib/email.ts:3-5`
- **Detail:** Singleton `Resend` dibuat saat module load HANYA dari `process.env.RESEND_API_KEY`. Test endpoint `/api/email/test` benar baca SystemSetting → env. Mismatch.
- **Impact:** Setelah rotate key via panel UI, semua notifikasi (article approved/rejected/published/new-review) tetap pakai env lama atau diam tanpa log. Test endpoint hijau tapi production diam.
- **Fix:** Refactor ke pola `getResendClient()` async yang baca SystemSetting → env, mirip `getApiKey()` di ai-client.
- **Delegasi:** `social-publisher` (atau `tech-lead`)

### CRIT-13 · [Backup/DR] No off-site backup — single point of failure
- **File:** `scripts/backup-db.sh`, `docs/DEPLOY_VPS.md`
- **Detail:** Semua `/var/backups/lensaplus/*.sql.gz` tinggal di VPS yang sama dengan DB. Disk fail / ransomware / Hostinger account loss = total data loss.
- **Impact:** RPO infinite kalau VPS hilang.
- **Fix:** Cron nightly `rclone copy /var/backups/lensaplus remote:bucket` ke Backblaze B2 / R2 / S3 dengan kredensial terpisah.
- **Delegasi:** `cron-engineer` + `tech-lead`

### CRIT-14 · [Backup/DR] /uploads tidak di-backup
- **File:** scripts/ tidak ada `backup-uploads.sh`
- **Detail:** `/var/www/lensaplus/public/uploads/` (article hero images, editor uploads) hanya tergantung disk VPS. backup-db.sh hanya pg_dump.
- **Impact:** VPS loss = semua media file hilang. Articles render dengan broken `<img>`.
- **Fix:** Tambah `tar -czf uploads-$(date +%F).tgz /var/www/lensaplus/public/uploads/` ke pipeline backup + off-site sync.
- **Delegasi:** `cron-engineer`

### CRIT-15 · [Design] email.ts hardcode #00AA13 (GoTo Green legacy)
- **File:** `src/lib/email.ts:20,25,46,58,68,78`
- **Detail:** 6 occurrences hex `#00AA13` di base template heading + footer link + 4 CTA buttons. Customer-visible transactional emails masih render brand lama.
- **Impact:** Brand inconsistency lintas channel.
- **Fix:** Replace ke `#002045` (primary navy).
- **Delegasi:** `design-guardian` + `frontend-dev`

### CRIT-16 · [Design] PrintButton + dashboard goto-green legacy gradient
- **File:** `src/components/artikel/PrintButton.tsx:95,105` (hex `#00AA13`/`#E6F9E8`); `src/app/panel/dashboard/page.tsx:524,588` (`from-goto-green to-goto-dark` gradient)
- **Detail:** Print preview render GoTo green di kertas. Dashboard gradient pakai deprecated alias token.
- **Fix:** Replace ke navy palette + gradient `from-primary to-primary-dark`.
- **Delegasi:** `frontend-dev`

## 🟠 HIGH — 44 Temuan Penting (Sprint berikutnya)

### Security & RBAC
- **HIGH-S1** SSRF scraper fetch tanpa `isPrivateHost` allowlist — `src/lib/scraper/fetch.ts` + `news-sources/[id]/scrape/route.ts`. Admin compromise → probe internal services (PostgreSQL 5432, cloud metadata).
- **HIGH-S2** `/panel/iklan` tanpa role check sama sekali — semua authenticated bisa lihat ad data + tombol delete (DELETE tetap di-guard di API tapi UX & data exposure issue).
- **HIGH-S3** Panel pages client-side guard (after mount) — race window di mana HTML rendered sebelum redirect.
- **HIGH-S4** `/api/polls/[id]/vote` tanpa rate-limit — IP spoof flood vote.
- **HIGH-S5** Login page hardcoded redirect → `/panel/dashboard` (callbackUrl ignored). Open-redirect via NextAuth `?callbackUrl=https://evil.com` (low risk, audit-recommend NextAuth `redirect` callback).

### Performance
- **HIGH-P1** `/berita/[slug]` `force-dynamic` — halaman paling sering di-share/crawl, LCP +200-500ms vs ISR. Fix: `revalidate=60` + `revalidatePath` (sudah di-call seo-auto).
- **HIGH-P2** 7 publik pages force-dynamic tanpa alasan (sorotan, sorotan/[slug], rangkuman, rangkuman/[slug], topik, topik/[slug], jadwal-sidang).
- **HIGH-P3** FeaturedImage tanpa `priority` di artikel detail — LCP +500-1500ms.
- **HIGH-P4** Hero homepage Image "Berita Terkini" lead tanpa `priority` di mobile.
- **HIGH-P5** `/api/articles` GET tanpa cap pada `limit` (sudah di CRIT-10 juga).

### Database
- **HIGH-D1** FK cascade defaults (8 relations) — Article→User/Category, Poll→Category, SocialTemplate→Category, TargetKeyword→Category, NewsSource→Category, AuditLog→User. Default Restrict silent → P2003.
- **HIGH-D2** `/api/cron/publish` N+1: sequential `prisma.article.update` + SEO update di loop.

### SEO
- **HIGH-SEO1** `/topik/[slug]` redirect 307 instead of 308 — duplicate content risk.
- **HIGH-SEO2** Organization+WebSite JSON-LD hanya di `/`, tidak di root layout. Sitelinks-search box tidak fire di entry deep.

### A11y
- **HIGH-A1** Homepage tanpa `<h1>` (HeroCarousel render h1 per slide → multiple h1).
- **HIGH-A2** Panel/dashboard 3× `<h1>` per page.
- **HIGH-A3** 6 panel page raw `<img>` tanpa alt yang informatif untuk admin lists (foto avatar/poll/redaksi).

### API Design
- **HIGH-API1** Cron `/api/cron/auto-article` + `/api/cron/sorotan` TOCTOU — concurrent invocations bisa duplikat artikel/sorotan. Fix: `prisma.$transaction` Serializable atau `pg_try_advisory_lock`.
- **HIGH-API2** Crons return 200 pada error → uptime probes / GA / status pages flag healthy padahal fail.
- **HIGH-API3** Inconsistent error shape — `{success:false}` tanpa `error` field di logout, `{message}` campur, `{success:true, skipped}` di cron.
- **HIGH-API4** 22 listings tanpa pagination cap (categories, tags acceptable; users/target-keywords/social-templates/panel-seo risky).
- **HIGH-API5** PUT semantics — `articles/[id]` PUT melakukan partial update (RFC 7231 says PATCH).

### Observability
- **HIGH-O1** AuditLog coverage 45% (48/87 mutation endpoints miss). Top-priority misses: `/api/settings` (API keys live here!), `/api/users/me`, `/api/news-sources/*`, `/api/email-routing`, `/api/seo/bulk-*`, `/api/ai/*`.
- **HIGH-O2** Sentry tanpa `beforeSend` PII filter — Authorization header / form body bisa ke-ship.
- **HIGH-O3** Zero manual `Sentry.captureException` di seluruh `src/`. Auto-instrumentation only.

### Integration Health
- **HIGH-I1** Cloudflare GraphQL Analytics tanpa AbortController timeout — dashboard hang.
- **HIGH-I2** GA4 + GSC tanpa explicit timeout option.
- **HIGH-I3** `purgeEverything()` tanpa AbortController (sister `purgeCache()` punya 15s).
- **HIGH-I4** Google Indexing API tanpa 429 quota counter — batch reindex generate 200+ identical errors saat quota habis.

### Privacy
- **HIGH-PR1** Privacy policy tidak menyebut UU PDP / cross-border transfer / vendor pihak ketiga.
- **HIGH-PR2** AuditLog.ip tanpa retention/purge — grow unbounded.
- **HIGH-PR3** PollVote.ip dengan `@@index` tanpa anonymize cron.
- **HIGH-PR4** Form `/kontak` tanpa privacy notice / link ke `/privasi`.

### Backup/DR
- **HIGH-B1** No `.env` production backup procedure — `SETTINGS_ENCRYPTION_KEY` lost = encrypted SystemSetting permanently unreadable.
- **HIGH-B2** Restore drill `scripts/backup-restore-drill.sh` exists tapi crontab `Optional` — tidak terkonfirmasi running di prod.
- **HIGH-B3** `backup-verify.sh` exists tapi tidak di crontab template — silent rolling failure.

### Dependencies
- **HIGH-DEP1** `next@14.2.35` — 5 high CVE chain (Image Optimizer DoS, RSC DoS, request smuggling, image cache exhaustion, Server Components DoS).
- **HIGH-DEP2** `glob@10.3.10` + `brace-expansion` CVE — dev tooling, low real risk.
- **HIGH-DEP3** `vite@8.0.3` 3 CVE — dev only (vitest), path traversal + WS file read.

## 🟡 MEDIUM — 52 Temuan (1-2 Sprint)

Detail per kategori, summary singkat (full per-finding ada di session log auditor):

- **DB:** Redundant `@@index([status])`, missing `@@index([status, viewCount(desc)])` for trending, missing select di homepage findMany (600KB transferred), Article.viewCount unconditional increment per request (write amplification).
- **Perf:** `/search` & `/iklan` tanpa explicit `dynamic`/`revalidate`, redaksi photos raw `<img>`, banner ads raw `<img>`, sitemap.ts tanpa explicit Cache-Control.
- **SEO:** Tag/author/category sitemap `lastmod=now()` (Google ignores), `/lokasi` & `/rangkuman` tanpa twitter card + breadcrumb, `/berita/[slug]` `<title>` bypass `seoTitle`, sitemap-news.xml `force-dynamic` + `revalidate` conflict.
- **A11y:** HeroCarousel pause control + aria-live missing, no global `prefers-reduced-motion` rule, `aria-required`/`aria-invalid` missing, kontras `txt-muted` (#74777f) on `bg-surface` (#f8f9fa) ratio 3.66:1 (fail AA normal text).
- **API:** 22 listings tanpa pagination cap (di-cap di HIGH-API4), 19 DELETE return 200 dengan body (should 204), PUT used as PATCH, manual NextResponse.json di 11 file bypass helper, no CORS headers.
- **Obs:** Backup cron tanpa `maxDuration`, no `/panel/error.tsx` segment boundary, no `src/app/global-error.tsx`, no `/api/health`.
- **Integration:** AI fallback fired pada all errors (4xx termasuk), IndexNow stale cache tanpa TTL, Meta token via querystring, in-memory cache stats per-PM2-instance (quota 4×).
- **Content Safety:** AI seoTitle/Description tidak via `cleanAIShortText` di seo-auto, DRAFT→PUBLISHED admin shortcut auto-set `verificationLabel=VERIFIED`, Report.detail raw stored.
- **Privacy:** No DSR endpoint (export/erasure), User model field eksesif untuk reader/CONTRIBUTOR (no role gate), ContactMessage/Report retention 0, NextAuth cookie tanpa explicit secure/sameSite/httpOnly, privacy policy tanpa retention period section.
- **Backup:** 7-day retention pendek + no off-site, no pre-`db push` snapshot, gzip integrity check pakai line count bukan `gzip -t`, no failure notification.
- **Deps:** `postcss@8.4.31` (transitive next), `sanitize-html@2.17.2` CVE (easy patch 2.17.3), `@anthropic-ai/sdk@0.90.0` CVE 0.95.1 fix, Prisma 5→7 major lag.
- **Design:** Header bg-`#1C1C1E` off-palette (need decision), NewsTicker market data emerald/red (semantic acceptable, document), WhatsApp button bg-green-500 (platform-brand exception), panel/artikel/edit "Terbitkan" button bg-green-600 (HIGH severity actually), accent-goto-green checkbox.

## ⚪ LOW — 31 Temuan (Best Practice)

- 16 `<img>` lint warnings → migrate ke `next/image`
- AuditLog DB failure swallow (10-min stale session window)
- Glossary `bodyHtml` defense-in-depth resanitize
- `/api/og` `force-dynamic` despite immutable cache header (CPU waste)
- IndexNow file orphan (`lensaplus-indexnow-key.txt`)
- Email template GoTo green (covered di CRIT-15)
- `User.twoFactorEnabled` set tapi never read
- `Article.coAuthors` CSV (unindexable)
- `SorotanAngle.FAQ` enum value never produced
- `CtaTemplate` model (zero references in src/)
- Sitemap chunk ke index kalau >1000 article
- `console.error` di error.tsx tanpa Sentry capture
- No structured logging (logger.ts)
- 404 vs 500 mapping (cosmetic)
- `auth/logout` raw NextResponse.json
- 11 file bypass helper response

## ℹ️ INFO

- `/api/setup` design exemplary (SETUP_KEY env + auto-disable + timingSafeEqual)
- External obsidian sync token verify — local duplikasi dengan `verifyCronSecret`
- HeroCarousel index 0 sudah `priority={i===0}` ✓
- TipTap dynamic import via `next/dynamic` di edit pages ✓
- Skip-link present (layout.tsx:127), `lang="id"` set, focus indicator global
- ARIA usage 123 occurrences across 37 files; Header.tsx exemplary
- Sentry `sendDefaultPii: false` set
- Newsletter double-opt-in OK
- No client-side tracker (GA4/Meta Pixel) → cookie consent banner tidak strictly required oleh UU PDP

## Remediation Roadmap

### Sprint 0 — IMMEDIATE (sebelum next deploy)

1. **CRIT-01 + CRIT-02** — Sanitize Article PUT + Revisions render. **Tanpa ini, stored XSS hidup di prod.**
2. **CRIT-03 + CRIT-04 + CRIT-10** — Pagination cap di `/api/users`, `/api/articles`, batch refactor `/api/ai/bulk-tags`.
3. **CRIT-09** — Fix `errorResponse({message, statusCode})` 500 mapping di reports + setup.
4. **CRIT-11 + CRIT-12** — Meta token expiry cron + Resend SystemSetting refactor.
5. **CRIT-13 + CRIT-14** — Off-site backup (rclone → Backblaze) + uploads backup.
6. **CRIT-15 + CRIT-16** — GoTo Green purge di email.ts + PrintButton + dashboard.
7. **CRIT-05 → CRIT-08** — A11y form labels + modal dialog semantics + reduced-motion guard.

### Sprint 1 — HIGH severity

- HIGH-S1 SSRF scraper, HIGH-S2 panel/iklan role check
- HIGH-O1 logAudit 48 endpoints (priority: settings, users, media, news-sources)
- HIGH-P1 sampai HIGH-P4 ISR migration + image priority
- HIGH-API1 cron TOCTOU advisory lock
- HIGH-API2 cron error code semantics
- HIGH-DEP1 next.js patch path
- HIGH-D1 FK cascade explicit
- HIGH-PR1 sampai HIGH-PR4 privacy policy + retention crons
- HIGH-B1 sampai HIGH-B3 .env backup + drill cron + verify cron

### Sprint 2 — MEDIUM batch

Group berdasarkan delegasi:
- `frontend-dev` — JSON-LD root layout, twitter card lokasi/rangkuman, header palette decision, image migration
- `api-dev` — DSR endpoints, listing pagination caps, retention crons (ContactMessage/Report/AuditLog/PollVote), DELETE 204
- `cron-engineer` — backup retention bucket weekly/monthly, gzip -t, db push pre-snapshot
- `seo-distributor` — sitemap lastmod proper, indexing quota tracker
- `ai-client-builder` — retry classifier `isRetryable`
- `analytics-connector` — timeout di stats/* + shared cache
- `social-publisher` — Meta token Querystring → Header

### Sprint 3 — LOW + INFO cleanup

Hygiene tasks: img element migration, dead column drop (User.twoFactorEnabled, Article.coAuthors review), CtaTemplate model decision, enum SorotanAngle.FAQ drop, structured logger.ts.

## Statistik Kuantitatif

- **Total file di-audit:** ~280 files (`src/app/api/route.ts` 112 + `src/app/**/page.tsx` 67 + `src/components` 87 + `src/lib` 53)
- **Endpoint mutation tanpa logAudit:** 48 / 87 (55%)
- **Endpoint pakai `errorResponse` helper:** 103 / 112 (92%)
- **Endpoint pakai Zod validation:** 58 (≈70% mutation endpoints)
- **Halaman publik dengan `force-dynamic` salah:** 9 / 32 (28%)
- **HTML input dengan sanitize:** 6 / 8 (75%)
- **State machine transitions verified:** 12 / 12
- **Cron secret verified:** 7 / 7 ✓ (Phase 12 H-1 holding)
- **Cron idempotent fully:** 4 / 7
- **Form input pair `htmlFor`:** 3 / 248 (≈1%)
- **JSON-LD coverage:** 14 / 14 templates ✓
- **Sitemap variants live:** 5 / 5 ✓
- **npm CVE runtime:** 0 critical, 1 high, 3 moderate
- **Test coverage:** 13 file (126 vitest pass) — 0% di src/lib/{seo,social,scraper,storage}
- **AuditLog grow unbounded:** YA
- **Off-site backup:** TIDAK
- **DSR endpoint:** TIDAK ADA

## Sign-off

- **Audit Lead:** `audit-lead` agent (Lensaplus v2.0)
- **Sub-auditors invoked:** 14 (security-auditor, auth-guardian, build-test-validator, design-guardian, dep-auditor, db-auditor, perf-auditor, seo-auditor, a11y-auditor, api-design-auditor, observability-auditor, integration-health-auditor, content-safety-auditor, backup-dr-auditor, privacy-compliance-auditor)
- **Total token usage estimate:** ~1.2M tokens
- **Audit duration:** ~50 menit (3 wave paralel)

**Verdict final:** ❌ **BLOCK RELEASE** — perlu Sprint 0 selesai sebelum deploy berikutnya. Setelah Sprint 0 + Sprint 1, status berubah jadi ⚠️ FIX RECOMMENDED dengan release bersyarat.

**Next step rekomendasi:**
1. User review report ini
2. Kalau setuju, panggil `tech-lead` untuk eksekusi Sprint 0 (parallel delegasi ke `api-dev`, `frontend-dev`, `cron-engineer`, `social-publisher`)
3. Setelah Sprint 0 selesai, panggil `audit-lead` mode `delta` untuk verify fix
4. Lalu `release-lead` untuk deploy
