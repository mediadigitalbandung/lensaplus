# FEATURE_REFERENCE — Spesifikasi Fitur Target Lensaplus

> **Project:** **Lensaplus v2.0** (lensaplus.com). Ini BUKAN project JHB.
> **Sumber referensi:** Dokumen master dari jurnalishukumbandung.com, dikirim user tgl 2026-04-24.
> Dokumen itu dipakai sebagai **daftar fitur target** — Lensaplus akan disamakan metode & fiturnya.
> Tidak ada rename/fork. Kode, brand, domain, repo tetap Lensaplus.
>
> **Cara baca:** Ketika dokumen ini menyebut "JHB", baca itu sebagai "metode/fitur yang harus
> ada di Lensaplus". Domain/brand JHB hanya muncul di konstanta lama; semua implementasi baru
> pakai brand Lensaplus (lensaplus.com, PM2 process `lensaplus`, dst.).

---

## Daftar Isi

1. Struktur & Peran
2. Workflow Artikel
3. Fitur Sistem
4. Integrasi Eksternal
5. API Reference
6. Components
7. Dependencies
8. Halaman Publik
9. Cron Jobs
10. Database & Panel
11. Tech Stack
12. Keamanan
13. Deploy & Backup
14. Quick Reference
15. Troubleshooting

---

## 1. Struktur & Peran

Hierarki 4 tingkat: `SUPER_ADMIN → EDITOR → JOURNALIST → CONTRIBUTOR`.

> **Catatan Lensaplus:** Role existing ada 6 (`SUPER_ADMIN`, `CHIEF_EDITOR`, `EDITOR`, `SENIOR_JOURNALIST`, `JOURNALIST`, `CONTRIBUTOR`). Opsi: (a) tetap 6, petakan 4-role logic ke 6-role; atau (b) kompres jadi 4. Default migrasi: **tetap 6**, Editor = {CHIEF_EDITOR, EDITOR}, Jurnalis = {SENIOR_JOURNALIST, JOURNALIST}.

### Matriks Izin (dari dokumentasi JHB)

| Aksi | SuperAdmin | Editor | Jurnalis | Kontributor |
|---|---|---|---|---|
| Tulis artikel baru | ✓ | ✓ | ✓ | ✓ |
| Edit artikel sendiri (DRAFT/REJECTED) | ✓ | ✓ | ✓ | ✓ |
| Edit artikel orang lain | ✓ | ✓ | ✗ | ✗ |
| Submit artikel untuk review | ✓ | ✓ | ✓ | ✓ |
| Publish artikel langsung | ✓ | ✓ | ✗ | ✗ |
| Approve/Reject artikel review | ✓ | ✓ | ✗ | ✗ |
| Archive / hide artikel publish | ✓ | ✓ | ✗ | ✗ |
| Hapus artikel permanen | ✓ | ✗ | ✗ | ✗ |
| Kelola kategori | ✓ | ✓ | ✗ | ✗ |
| Kelola tags & keyword riset | ✓ | ✓ | ✗ | ✗ |
| Moderasi komentar | ✓ | ✓ | ✗ | ✗ |
| Kelola polling | ✓ | ✓ | ✗ | ✗ |
| Kelola user & role | ✓ | ✗ | ✗ | ✗ |
| Ubah pengaturan sistem + API keys | ✓ | ✗ | ✗ | ✗ |
| Kelola iklan | ✓ | ✗ | ✗ | ✗ |
| Auto-generate artikel AI | ✓ | ✗ | ✗ | ✗ |
| Setup sosmed (IG/FB) | ✓ | ✗ | ✗ | ✗ |
| Takedown post sosmed | ✓ | ✗ | ✗ | ✗ |
| Akses audit log | ✓ | ✗ | ✗ | ✗ |
| Akses statistik website (GA4/GSC/Cloudflare) | ✓ | ✗ | ✗ | ✗ |
| Akses dokumen master `/panel/dokumentasi` | ✓ | ✗ | ✗ | ✗ |

---

## 2. Workflow Artikel

```
DRAFT → IN_REVIEW → (APPROVED → PUBLISHED) | (REJECTED → back to DRAFT) → ARCHIVED
```

| Status | Deskripsi |
|---|---|
| DRAFT | Sedang ditulis, belum di-submit |
| IN_REVIEW | Menunggu review editor |
| APPROVED | Disetujui editor, siap publish |
| REJECTED | Ditolak editor, perlu revisi jurnalis |
| PUBLISHED | Live di website |
| ARCHIVED | Disembunyikan dari publik (URL jadi 404) |

### Transisi

| Dari | Ke | Siapa | Aksi |
|---|---|---|---|
| DRAFT | IN_REVIEW | Jurnalis | Klik "Kirim untuk Review" |
| IN_REVIEW | PUBLISHED | Editor | Klik "Publish" (auto-trigger SEO + sosmed) |
| IN_REVIEW | REJECTED | Editor | Klik "Tolak" dengan catatan revisi |
| REJECTED | DRAFT | Jurnalis | Edit ulang → auto kembali ke DRAFT |
| DRAFT | PUBLISHED | Editor/Admin | Publish langsung (skip review) |
| PUBLISHED | ARCHIVED | Admin | Sembunyikan dari publik |

### Aksi Otomatis saat `PUBLISHED` (non-blocking, paralel)

1. **Auto-SEO generate** — seoTitle, seoDescription, Sorotan, FAQ via AI (Claude Haiku)
2. **Submit ke Google** — Indexing API + IndexNow (Bing)
3. **Auto-post Instagram** — render template 4:5 + caption + hashtag → Meta Graph API
4. **Auto-post Facebook** — link share atau photo post sesuai kategori
5. **Auto-share Twitter/X** — tweet otomatis dengan link + hashtag
6. **Purge Cloudflare cache** — invalidate homepage + kategori + artikel
7. **Notifikasi penulis** — email + in-panel notification

---

## 3. Fitur Sistem (Target State)

### Konten
- **Editor rich-text TipTap** — image crop, tabel, embed (AKTIF)
- **Autosave draft** — tiap 15 detik + on `beforeunload` (AKTIF)
- **Export PDF & Teks** — download dari panel (AKTIF)
- **Polling terintegrasi** — 1 polling per artikel, auto-gen AI (AKTIF)
- **Sistem komentar** — moderasi + notifikasi, approve/reject (AKTIF)
- **Tags Manager + Riset Keyword AI** — kelola tags, riset SEO, auto-tags (AKTIF)

### AI & Otomasi
- **Auto-artikel AI** — cron generate draft dari keyword (BELUM AKTIF)
- **Anthropic API (Claude Haiku 4.5)** — provider utama (BELUM AKTIF)
- **DeepSeek API** — fallback (AKTIF)
- **SEO auto-generate** — title, desc, Sorotan, FAQ saat publish (AKTIF)
- **Caption sosmed AI** — generate caption IG/FB dari konten (AKTIF)

### SEO & Distribusi
- **Sitemap otomatis** — `/sitemap.xml` + news sitemap 2 hari terakhir (AKTIF)
- **Structured data JSON-LD** — Article, NewsArticle, BreadcrumbList, FAQPage, HowTo, QAPage (AKTIF)
- **Google Indexing API** — submit URL baru (BELUM AKTIF, butuh credentials)
- **IndexNow (Bing)** — ping Bing/Yandex setiap publish (AKTIF)
- **Cloudflare cache purge** — invalidate saat publish (AKTIF)
- **Internal linking** — auto-inject related article links (AKTIF)
- **Sorotan SEO pages** — 3 halaman substantif per artikel (kronologi/analisis/dampak) (AKTIF)

### Media Sosial
- **Auto-post Instagram** — template 4:5 + caption + hashtag via Meta Graph API (BELUM AKTIF)
- **Auto-post Facebook** — link share atau photo post dengan template (BELUM AKTIF)
- **Twitter/X auto-share** (BELUM AKTIF)
- **Template gambar sosmed** — PNG + text layers (Sharp rendering) (AKTIF)
- **Draft mode review** — toggle preview + approve manual sebelum post (AKTIF)

### Monitoring & Analytics
- **Dashboard statistik** — artikel, views, pending, trend mingguan (AKTIF)
- **Google Analytics GA4** (AKTIF)
- **Google Search Console** — impression, klik, CTR, position (AKTIF)
- **Cloudflare Analytics** — bandwidth, cache hit rate (AKTIF)
- **AI usage log** (AKTIF)
- **Audit log** — semua aksi user tercatat (AKTIF)

### Sistem & Keamanan
- **NextAuth** — email/password, JWT, role-based (AKTIF)
- **Password hashing bcrypt 12 rounds** (AKTIF)
- **CSRF protection** — token per POST/PUT/DELETE (AKTIF)
- **Rate limiting** — API AI dibatasi per user per jam (AKTIF)
- **Email notifikasi** — Resend untuk review/approve/reject (BELUM AKTIF)

---

## 4. Integrasi Eksternal

| Integrasi | Keys di SystemSetting | Status JHB | Setup |
|---|---|---|---|
| Anthropic (Claude Haiku 4.5) | `anthropic_api_key` | Belum dikonfigurasi | `/panel/pengaturan` |
| DeepSeek | `deepseek_api_key` | Terhubung | `/panel/pengaturan` |
| Meta Graph API (IG + FB) | `meta_access_token`, `ig_user_id`, `fb_page_id` | Belum dikonfigurasi | `/panel/social` |
| Google Indexing API + GSC | `google_credentials_json`, `google_indexing_enabled` | Terhubung | `/panel/pengaturan` |
| Google Analytics 4 | `google_credentials_json` | Terhubung | `/panel/pengaturan` |
| Cloudflare | `cloudflare_api_token`, `cloudflare_zone_id` | Terhubung | `/panel/pengaturan` |
| Resend (Email) | `resend_api_key`, `notification_email_from` | Belum dikonfigurasi | `/panel/pengaturan` |
| Twitter/X API | `twitter_bearer_token`, `twitter_access_token`, `twitter_access_secret`, `twitter_consumer_key`, `twitter_consumer_secret` | Belum dikonfigurasi | `/panel/pengaturan` |
| IndexNow (Bing) | (no auth) | Terhubung | `public/indexnow-key.txt` |

Token Meta expire 60 hari — perlu refresh manual di Meta Business Suite.

---

## 5. API Reference (75+ Endpoint)

Format response: `{ success: boolean, data?, error? }`. Cron endpoint butuh header `Authorization: Bearer <CRON_SECRET>`.

### Articles (12)
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/api/articles` | public | List published + filter kategori/author/status |
| POST | `/api/articles` | JOURNALIST+ | Buat artikel baru |
| GET | `/api/articles/:id` | public | Detail + increment viewCount |
| PUT | `/api/articles/:id` | JOURNALIST+ | Update/approve/publish/reject |
| PATCH | `/api/articles/:id` | EDITOR+ | Assign editor |
| DELETE | `/api/articles/:id` | owner/ADMIN | Hapus (cascade Source, Tag, Revision) |
| POST | `/api/articles/bulk` | EDITOR+ | Buat banyak sekaligus |
| POST | `/api/articles/by-slugs` | public | Ambil dari array slug (untuk embed) |
| POST | `/api/articles/toggle-visibility` | JOURNALIST+ | Hide/unhide published (ARCHIVED) |
| GET | `/api/articles/:id/revisions` | JOURNALIST+ | Riwayat revisi |
| GET | `/api/articles/:id/comments` | public | List komentar |
| POST | `/api/articles/:id/comments` | public | Tambah komentar |

### AI (3)
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| POST | `/api/ai/generate` | JOURNALIST+ | Generate teks (feature: title/meta/caption) |
| POST | `/api/ai/bulk-tags` | EDITOR+ | Auto-gen tags batch |
| GET | `/api/ai/usage` | SUPER_ADMIN | Statistik pemakaian token |

### Categories & Tags (10)
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/api/categories` | public | List |
| POST | `/api/categories` | EDITOR+ | Buat baru |
| PUT | `/api/categories/:id` | EDITOR+ | Edit |
| DELETE | `/api/categories/:id` | EDITOR+ | Hapus |
| GET | `/api/tags` | public | List |
| POST | `/api/tags` | JOURNALIST+ | Buat |
| DELETE | `/api/tags` | SUPER_ADMIN | Bulk delete |
| GET | `/api/tags/articles` | public | Artikel per tag |
| GET | `/api/tags/stats` | public | Statistik pemakaian |
| POST | `/api/tags/research` | EDITOR+ | AI riset keyword |

### SEO & Indexing (10)
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| POST | `/api/seo/submit` | EDITOR+ | Submit ke GSC |
| POST | `/api/seo/ping` | CRON | Ping search engines |
| GET | `/api/seo/status` | EDITOR+ | Status indexing artikel |
| GET | `/api/seo/sorotan-status` | EDITOR+ | Status indexing sorotan |
| POST | `/api/seo/sorotan-status` | EDITOR+ | Update status |
| POST | `/api/seo/batch-index` | EDITOR+ | Batch submit |
| POST | `/api/seo/bulk-reindex` | SUPER_ADMIN | Reindex semua |
| POST | `/api/seo/generate-sorotan` | EDITOR+ | Generate sorotan batch |
| POST | `/api/seo/generate-sorotan-single` | EDITOR+ | Generate 1 sorotan (retry-able) |
| POST | `/api/seo/test-credentials` | SUPER_ADMIN | Test kredensial Google |

### Social Media (15)
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/api/social/posts` | EDITOR+ | List post sosmed + stats |
| POST | `/api/social/posts/:id/approve` | EDITOR+ | Approve draft → publish ke Meta |
| POST | `/api/social/posts/:id/reject` | EDITOR+ | Tolak draft (delete DB + image) |
| POST | `/api/social/posts/:id/mark-deleted` | EDITOR+ | Tandai dihapus manual di IG/FB |
| POST | `/api/social/posts/:id/takedown` | EDITOR+ | Hapus di platform (FB only) |
| GET | `/api/social/settings` | SUPER_ADMIN | Settings global/IG/FB |
| PUT | `/api/social/settings` | SUPER_ADMIN | Update settings |
| GET | `/api/social/templates` | EDITOR+ | List template gambar |
| POST | `/api/social/templates` | EDITOR+ | Buat template |
| GET | `/api/social/templates/:id` | EDITOR+ | Get detail |
| PUT | `/api/social/templates/:id` | EDITOR+ | Update |
| DELETE | `/api/social/templates/:id` | EDITOR+ | Hapus |
| POST | `/api/social/templates/preview` | EDITOR+ | Preview render template + artikel |
| POST | `/api/social/preview` | EDITOR+ | Preview caption + image (no post) |
| POST | `/api/social/test-publish` | SUPER_ADMIN | Test publish artikel terbaru ke IG+FB |

### Ads, Polls, Comments (17)
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/api/ads` | public | Iklan aktif (slot, targetPages) |
| POST | `/api/ads` | SUPER_ADMIN | Buat |
| PUT | `/api/ads/:id` | SUPER_ADMIN | Update |
| DELETE | `/api/ads/:id` | SUPER_ADMIN | Hapus |
| POST | `/api/ads/:id/track` | public | Track click/impression |
| GET | `/api/polls` | public | List aktif |
| POST | `/api/polls` | EDITOR+ | Buat |
| PUT | `/api/polls/:id` | EDITOR+ | Update |
| DELETE | `/api/polls/:id` | EDITOR+ | Hapus |
| POST | `/api/polls/:id/vote` | public | Vote (dedup IP+fingerprint) |
| GET | `/api/polls/:id/vote` | public | Hasil real-time |
| GET | `/api/polls/from-article` | public | Polling artikel tertentu |
| POST | `/api/polls/from-article` | EDITOR+ | Generate dari artikel via AI |
| GET | `/api/comments` | public | List komentar |
| POST | `/api/comments` | public | Submit komentar (auto-moderate) |
| PUT | `/api/comments/:id` | EDITOR+ | Approve/reject |
| DELETE | `/api/comments/:id` | EDITOR+ | Hapus |

### Users & Auth (8)
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/api/users` | SUPER_ADMIN | List |
| POST | `/api/users` | SUPER_ADMIN | Buat |
| PUT | `/api/users/:id` | self/ADMIN | Update profile |
| DELETE | `/api/users/:id` | SUPER_ADMIN | Hapus |
| GET | `/api/users/me` | auth | Profile sendiri |
| PUT | `/api/users/me` | auth | Update profile sendiri |
| POST | `/api/auth/[...nextauth]` | public | NextAuth handler |
| POST | `/api/auth/logout` | auth | Logout + invalidate session |

### Statistics & Analytics (4)
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/api/stats/internal` | EDITOR+ | Stats internal DB |
| GET | `/api/stats/cloudflare` | EDITOR+ | Analytics Cloudflare |
| GET | `/api/stats/google-analytics` | EDITOR+ | Data GA4 |
| GET | `/api/stats/google-search` | EDITOR+ | Data GSC |

### Media & Upload (5)
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/api/media` | JOURNALIST+ | List library |
| POST | `/api/media` | JOURNALIST+ | Upload dengan metadata |
| PUT | `/api/media/:id` | uploader | Update caption/source |
| DELETE | `/api/media` | JOURNALIST+ | Bulk delete |
| POST | `/api/upload` | JOURNALIST+ | Upload file langsung |

### Court, Reports, Redaksi (11)
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/api/court-schedule` | public | List jadwal sidang |
| POST | `/api/court-schedule` | JOURNALIST+ | Tambah jadwal |
| PUT | `/api/court-schedule/:id` | JOURNALIST+ | Update |
| DELETE | `/api/court-schedule/:id` | JOURNALIST+ | Hapus |
| GET | `/api/reports` | EDITOR+ | List laporan |
| POST | `/api/reports` | public | Kirim laporan artikel |
| PATCH | `/api/reports/:id` | EDITOR+ | Update status |
| GET | `/api/redaksi` | public | List anggota |
| POST | `/api/redaksi` | SUPER_ADMIN | Tambah |
| PUT | `/api/redaksi/:id` | SUPER_ADMIN | Update |
| DELETE | `/api/redaksi/:id` | SUPER_ADMIN | Hapus |

### System & Settings (14)
| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/api/settings` | SUPER_ADMIN | Semua key-value |
| PUT | `/api/settings` | SUPER_ADMIN | Update 1 setting |
| GET | `/api/audit-logs` | SUPER_ADMIN | Audit log filter |
| GET | `/api/notifications` | auth | Notifikasi user |
| PATCH | `/api/notifications` | auth | Mark read |
| GET | `/api/target-keywords` | EDITOR+ | List keyword SEO |
| POST | `/api/target-keywords` | EDITOR+ | Tambah |
| PATCH | `/api/target-keywords` | EDITOR+ | Update isActive |
| DELETE | `/api/target-keywords` | SUPER_ADMIN | Hapus |
| POST | `/api/contact` | public | Submit kontak form |
| GET | `/api/search` | public | Global search |
| GET | `/api/search/suggest` | public | Autocomplete |
| GET | `/api/trending` | public | Trending (viewCount) |
| GET | `/api/setup` | public | Cek status setup (first-time) |

### Cron (3) — Bearer CRON_SECRET
| Method | Path | Fungsi |
|---|---|---|
| GET/POST | `/api/cron/publish` | Publish scheduled + trigger auto-actions |
| GET/POST | `/api/cron/auto-article` | Generate artikel dari keyword target |
| GET | `/api/cron/seo-ping` | Ping GSC + IndexNow untuk yg belum ter-index |

---

## 6. Components (35+)

### layout/
`Header`, `PublicNav`, `Sidebar`, `Footer`, `PublicFooter`, `TopLoader`, `NewsTicker`, `TrendingTags`, `HorizontalScroll`, `ScrollableContainer`, `ZoomCompensator`

### artikel/
`ArticleCard`, `SearchableArticleList`, `PaginatedArticles`, `CommentSection`, `ShareBar`, `BookmarkButton`, `PrintButton`, `ReadingProgress`, `CopyProtection`

### editor/
`RichTextEditor` (TipTap: bold, italic, heading, list, link, image, table, embed, AI tools), `ImageUploader`, `ImageCropModal`

### slider/
`HeadlineSlider`, `SubHeadlineSlider`, `BreakingSlider`, `PopularCarousel`, `PollingCarousel`, `VideoStory`

### ui/
`Toast` + `useToast`, `ConfirmDialog` + `useConfirm`

### ads/
`BannerAd`

### root/
`Providers` (SessionProvider + ToastProvider + ConfirmProvider), `ServiceWorkerRegistration`, `GoogleAnalytics`

### lib/ (utilities)
- `ai-client.ts` — `callAI()` shared: Claude primary + DeepSeek fallback
- `api-utils.ts` — `requireAuth`, `requireRole`, `successResponse`, `errorResponse`, `ApiError`, `logAudit`
- `auth.ts` — NextAuth config + permission helpers
- `prisma.ts` — singleton
- `roles.ts` — role constants
- `utils.ts` — `slugify`, `calculateReadTime`, `cn`, `toJakartaISO`
- `sanitize.ts` — HTML allowlist
- `article-status.ts` — state machine `canTransition(from, to, role)`
- `rate-limit.ts` — in-memory rate limiter
- `seo-utils.ts` — `onArticlePublished`, `autoGenerateSeoFields`, `autoGenerateFaq`, `autoGenerateSorotan`, Cloudflare purge, Twitter share, IndexNow
- `email.ts` — Resend wrapper + templates
- `notifications.ts` — `createNotification`
- `export-utils.ts` — PDF (jsPDF) / TXT export
- `csv-utils.ts` — parse/generate CSV
- `video-data.ts` — YouTube/TikTok embed parser
- `social/types.ts` — `Platform`, `PublishStatus`, `PublishResult`, `PreparedPost`, `ArticleForPublish`
- `social/instagram.ts` — `InstagramPublisher` class (Meta Graph API v21 container → media_publish)
- `social/facebook.ts` — `FacebookPublisher` (link_share + photo post)
- `social/orchestrator.ts` — `publishArticleToSocial`, `approveDraft`/`rejectDraft`/`takedownPost`
- `social/caption-generator.ts` — `generateSocialCaption()` (AI + hashtag + CTA)
- `social/ai-caption.ts` — `generateCaptionForTemplate()` (paraphrased title + shortSummary)
- `social/template-renderer.ts` — `renderTemplate()` via Sharp (composite photo + text layers)
- `social/template-helper.ts` — `findTemplateForPlatform`, `renderAndStoreTemplate`, `enrichArticleForTemplate`

---

## 7. Dependencies (Target)

### Core Framework
`next` 14.2, `react` 18.3, `react-dom` 18.3, `typescript` 5.4

### Database & ORM
`@prisma/client` 5.22, `prisma` 5.22

### Auth & Security
`next-auth` 4.24, `bcryptjs` 2.4, `sanitize-html` 2.17, `zod` 3.23

### Content Editor
`@tiptap/react` 3.20, `@tiptap/starter-kit` 3.20, `@tiptap/extension-image`, `-table`, `-link`, `-underline` 3.20

### AI Providers
`@anthropic-ai/sdk` 0.90 (Claude Haiku 4.5 primary)
`DeepSeek` via fetch (fallback, no SDK needed)

### External APIs
`googleapis` 171.4 (bundle: Search Console, Indexing, Analytics, Drive)
`resend` 6.9 (transactional email)

### Image Processing
`sharp` 0.34 — template render + resize + JPEG compress

### UI & Visualization
`lucide-react` 0.400, `recharts` 3.8 (dashboard charts), `tailwind-merge` 2.3, `clsx` 2.1

### Export & Utilities
`jspdf` 4.2, `date-fns` 3.6

### Styling
`tailwindcss` 3.4, `postcss` 8.4, `autoprefixer` 10.4

### Testing & Quality
`vitest` 1.6, `eslint` 8.57, `eslint-config-next` 14.2

### Catatan Update
- Next.js 14.2 → **JANGAN** upgrade ke 15 tanpa testing App Router breaking
- Prisma 5.22 → stable, bisa ke 6 tapi regenerate types
- TipTap 3.20 → sudah handle breaking v2→v3 di `RichTextEditor.tsx`
- Sharp 0.34 → perlu rebuild binding per arch (x86_64 vs ARM) — otomatis via `postinstall`
- Anthropic SDK 0.90 → model `claude-haiku-4-5` boleh update ke versi baru

---

## 8. Halaman Publik (29)

### Homepage & Discovery
- `/` — hero slider, headline, breaking news, kategori, trending
- `/search` — global search + filter + suggest
- `/topik` — daftar topik/kategori
- `/topik/[slug]` — detail topik + sub-kategori
- `/bookmark` — localStorage bookmark

### Artikel
- `/berita` — semua artikel published (paginated)
- `/berita/[slug]` — detail + komentar + share + related
- `/kategori/[slug]` — per kategori (Pidana, Perdata, Tata Negara, dll)
- `/tag/[slug]` — per tag
- `/penulis/[slug]` — profile penulis + karya

### Ringkasan & Sorotan
- `/sorotan` — list halaman Sorotan SEO
- `/sorotan/[slug]` — detail 300-500 kata angle spesifik
- `/rangkuman` — halaman rangkuman umum
- `/rangkuman/[slug]` — rangkuman per topik
- `/rangkuman/harian` — rangkuman berita harian
- `/rangkuman/harian/[slug]` — per tanggal

### Jadwal & Lokasi
- `/jadwal-sidang` — scheduled/live/done
- `/lokasi` — direktori lokasi/pengadilan
- `/lokasi/[slug]` — detail lokasi

### Informasi & Legal
- `/tentang`, `/redaksi`, `/kode-etik`, `/pedoman-media`, `/syarat-ketentuan`, `/privasi`, `/iklan`, `/kontak`

### Auth & System
- `/login`, `/offline`

### SEO Routes
- `/sitemap.xml` — main (artikel published)
- `/sitemap-news.xml` — News sitemap (2 hari terakhir, format Google News)
- `/robots.txt` — directive + sitemap refs
- `/opengraph-image/route` — dynamic OG image per artikel

---

## 9. Cron Jobs

Setup di VPS via `crontab -e`:
```
*/5 * * * * curl -X POST https://lensaplus.com/api/cron/publish -H "Authorization: Bearer ${CRON_SECRET}"
```

| Endpoint | Jadwal | Fungsi |
|---|---|---|
| `/api/cron/auto-article` | tiap 1 jam (config) | Generate 1 artikel draft dari keyword target |
| `/api/cron/publish` | tiap 5 menit | Cek `scheduledAt <= now` + status IN_REVIEW/APPROVED → PUBLISHED + `onArticlePublished` |
| `/api/cron/sorotan` | tiap 6 jam | Cari artikel PUBLISHED tanpa Sorotan → generate 3 angle |
| `/api/cron/seo-submit` | tiap 12 jam | Retry artikel dengan `indexStatus='failed'` |
| `/api/cron/backup` | tiap 24 jam (dini hari) | `pg_dump` + `rsync` media. Retensi 7 hari. |

---

## 10. Database & Panel

### Model DB (27 target)

Lensaplus saat ini punya 18 model. Yang perlu **DITAMBAH**:

1. **Sorotan** — 3 halaman substantif SEO per artikel (angle berbeda: kronologi/analisis/dampak). Fields: `id`, `slug`, `articleId`, `angle`, `title`, `content`, `indexStatus`, `lastIndexedAt`.
2. **SocialPost** — record post ke IG/FB/Twitter. Fields: `id`, `articleId`, `platform`, `status` (DRAFT/PENDING/PUBLISHED/REJECTED/DELETED), `externalId`, `imageUrl`, `caption`, `publishedAt`, `errorMessage`, `deletedAt`.
3. **SocialTemplate** — template gambar: `id`, `name`, `platform`, `categoryId?`, `backgroundUrl`, `textLayers` (JSON: pos/font/color/maxWidth), `isActive`.
4. **SocialMediaSettings** — global: `id`, `draftMode`, `autoPublishIG`, `autoPublishFB`, `autoPublishTwitter`, `defaultHashtags`, `defaultCTA`.
5. **InstagramSettings** — `accessToken`, `igUserId`, `templateDefaultId`, `enabled`, `captionMaxLen`, `hashtagCount`.
6. **FacebookSettings** — `pageId`, `accessToken`, `postMode` (link/photo), `templateDefaultId`, `enabled`.
7. **CourtSchedule** — `id`, `caseName`, `caseNumber`, `courtName`, `scheduledAt`, `status` (SCHEDULED/LIVE/DONE), `notes`.
8. **TargetKeyword** — `id`, `keyword`, `categoryId?`, `priority`, `isActive`, `lastGeneratedAt`.
9. **CtaTemplate** — overlay CTA untuk iklan/konten: `id`, `name`, `html`, `position`, `isActive`.

### Field-level Tambahan ke `Article` (expand existing model)

- `coAuthors: String?` — co-author nama-nama
- `isAutoGenerated: Boolean @default(false)` — flag AI-generated
- `sourceArticleId: String?` — artikel sumber (untuk re-written/spun articles)
- `publishToInstagram: Boolean?` — override per-artikel
- `publishToFacebook: Boolean?` — override per-artikel
- `publishToTwitter: Boolean?` — override per-artikel
- `socialCaptions: Json?` — caption custom per platform
- `faqData: String?` — JSON-LD FAQ schema string
- `indexStatus: String? @default("pending")` — `pending|submitted|indexed|failed`
- `lastIndexedAt: DateTime?`

### Halaman Panel (target)

`/panel/dashboard`, `/panel/artikel`, `/panel/kategori`, `/panel/tags` (NEW: Tags Manager + Riset Keyword AI + generate dari tag), `/panel/komentar`, `/panel/laporan`, `/panel/iklan`, `/panel/redaksi`, `/panel/polling`, `/panel/statistik` (NEW: GA4+GSC+Cloudflare+internal), `/panel/statistik-editor`, `/panel/aktivitas`, `/panel/seo` (SEO Monitor), `/panel/sorotan` (NEW), `/panel/auto-artikel` (NEW), `/panel/social` (NEW: post IG/FB + template), `/panel/ai-log`, `/panel/pengguna`, `/panel/pengaturan`, `/panel/jadwal-sidang` (NEW), `/panel/media`, `/panel/dokumentasi` (NEW: copy of this spec).

---

## 11. Tech Stack

**Arsitektur:** monolithic Next.js app — frontend + API routes + server components. Single PM2 cluster di VPS. PostgreSQL same-host.

### Frontend
Next.js 14.2, TypeScript strict, Tailwind + custom tokens, TipTap, Lucide, Recharts.

### Backend
Next.js API routes, Prisma 5.22, PostgreSQL 16, NextAuth (credentials + JWT), bcryptjs 12, Zod, Sharp.

### AI & Otomasi
Anthropic SDK (Claude Haiku 4.5), DeepSeek (fallback), shared `src/lib/ai-client.ts` dengan `callAI()` auto-fallback, cron jobs `/api/cron/**`.

### Integrasi Eksternal
Meta Graph API v21, Google Indexing API, Google Search Console API, Google Analytics Data API, Cloudflare API, Resend, Twitter/X API v2 (OAuth 1.0a user context), IndexNow.

### Infrastructure
VPS Ubuntu 24.04 (145.79.15.99, port 3001 internal, 443 public), PM2 cluster (4 instances), Nginx reverse proxy + SSL, Cloudflare CDN + DDoS, Let's Encrypt, GitHub source.

---

## 12. Keamanan

### Autentikasi & Session
- bcrypt 12 rounds (min 8 char password)
- Session JWT signed `NEXTAUTH_SECRET`, expire 30 hari (JHB) — Lensaplus saat ini 24 jam; pertahankan 24 jam atau ikuti 30 hari (opsi konfigurasi)
- Invalidate session on password reset
- Email identifier unik, lowercase

### API Security
- `requireAuth()` di semua protected routes
- `requireRole([...])` untuk role-gated endpoints
- Zod validation di POST/PUT
- CSRF via NextAuth
- Rate limiting AI endpoints per user/jam

### Data Protection
- API keys di `SystemSetting` DB (tidak di source), hanya SUPER_ADMIN read/write
- Masking show/hide di UI
- `.env` di `.gitignore`
- Sanitasi HTML konten (TipTap + server-side cleanup)
- Google service account JSON di DB, bukan filesystem

### Infrastructure
- HTTPS wajib (Let's Encrypt auto-renewal)
- Cloudflare DDoS + WAF
- UFW firewall — port 22, 80, 443 only. PostgreSQL 5432 local-only
- SSH key-only (`PasswordAuthentication no`)
- Nginx security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

### Audit & Logging
- `AuditLog` per aksi sensitif (create/update/delete artikel, user, iklan)
- `AIUsageLog` per call AI (feature, user, article, sukses/gagal)
- PM2 logs rotasi 10MB
- Nginx access log (IP, UA, response code)

### Best Practices (operational)
- Rotate API keys tiap 6 bulan
- Tidak share akun SUPER_ADMIN
- Password kuat 12+ char
- Logout di perangkat publik
- Backup DB mingguan eksternal

---

## 13. Deploy & Backup

### Info VPS (JHB)
- IP: `145.79.15.99`
- Domain: `jurnalishukumbandung.com` → **Lensaplus: `lensaplus.com`**
- App dir: `/var/www/jhb` → **Lensaplus: `/var/www/lensaplus`**
- PM2 process: `jhb` → **Lensaplus: `lensaplus`**
- Port internal: 3001
- OS: Ubuntu 24.04 LTS
- Node: v20.x LTS
- DB: PostgreSQL 16 (localhost)

### Alur Deploy
```
1. npx next build                          # lokal
2. git add [files] && git commit && git push origin master
3. ssh root@145.79.15.99 "cd /var/www/lensaplus && git pull && npm install && rm -rf .next/types && npm run build && pm2 restart lensaplus"
4. ssh root@145.79.15.99 "pm2 list"       # verify online
```

### Backup
```
# DB
pg_dump -U lensaplus_user lensaplus > /var/backups/lensaplus-$(date +%Y%m%d).sql
# Restore
psql -U lensaplus_user lensaplus < /var/backups/lensaplus-YYYYMMDD.sql

# Media: rsync /var/www/lensaplus/public/uploads harian
# Code: git clone dari GitHub
# Settings & keys: backup bareng DB + backup .env manual
```

### Disaster Recovery
1. VPS down → Hostinger support
2. DB corrupt → psql restore dari backup terbaru
3. Source hilang → `git clone` + restore `.env` manual
4. Domain expired → cek Cloudflare DNS + registrar
5. SSL expired → `certbot renew --force-renewal`
6. Meta/IG token expired → refresh di Meta Business Suite + update panel
7. AI quota habis → auto-fallback ke provider cadangan

---

## 14. Quick Reference

### SystemSetting Keys

| Key | Deskripsi |
|---|---|
| `site_name`, `site_description`, `contact_email`, `alamat_redaksi`, `website_url` | Branding/SEO dasar |
| `anthropic_api_key` | Claude (utama) |
| `deepseek_api_key` | DeepSeek (fallback) |
| `resend_api_key`, `notification_email_from` | Email notifikasi |
| `enable_comments`, `enable_ai`, `maintenance_mode` | Toggle global |
| `google_credentials_json`, `google_indexing_enabled` | GSC + GA4 + Indexing |
| `cloudflare_api_token`, `cloudflare_zone_id` | Cache purge |
| `auto_article_enabled`, `auto_article_count`, `auto_article_interval` | Cron auto-artikel |
| `twitter_bearer_token`, `twitter_access_token`, `twitter_access_secret`, `twitter_consumer_key`, `twitter_consumer_secret` | Twitter API |

### Environment Variables (`.env` — WAJIB, tidak di DB)
```
DATABASE_URL="postgresql://lensaplus_user:PASSWORD@localhost:5432/lensaplus"
DIRECT_URL="postgresql://lensaplus_user:PASSWORD@localhost:5432/lensaplus"
NEXTAUTH_SECRET="..."                    # random 32+ char
NEXTAUTH_URL="https://lensaplus.com"
NEXT_PUBLIC_APP_URL="https://lensaplus.com"
CRON_SECRET="..."                        # Bearer token cron endpoints
UPLOAD_DIR="public/uploads"
NODE_ENV="production"
```

### Command Reference
```bash
# Lokal
npm install
npx prisma db push
npx prisma studio
npm run dev
npx next build

# VPS via SSH
ssh root@145.79.15.99
cd /var/www/lensaplus
git pull origin master
npm install
rm -rf .next/types
npm run build
pm2 restart lensaplus
pm2 list
pm2 logs lensaplus --lines 100
pm2 monit

# DB
psql -U lensaplus_user -d lensaplus
pg_dump -U lensaplus_user lensaplus > bck.sql
psql -U lensaplus_user lensaplus < bck.sql

# SSL & Nginx
certbot renew --dry-run
systemctl reload nginx
nginx -t
```

### URL Endpoint Penting
| URL | Fungsi |
|---|---|
| `/sitemap.xml` | Main sitemap untuk GSC |
| `/sitemap-news.xml` | News sitemap (2 hari terakhir) |
| `/robots.txt` | Crawler directive |
| `/feed.xml` atau `/rss` | RSS feed |
| `/api/cron/publish` | Trigger publish scheduled |
| `/api/cron/auto-article` | Generate AI |
| `/api/health` atau `/api/status` | Health check |

### Kontak & Kredensial
- GitHub Repo: github.com/mediadigitalbandung/lensaplus
- VPS Provider: Hostinger (hpanel.hostinger.com)
- DNS: Cloudflare (dash.cloudflare.com)
- Meta Developer: developers.facebook.com/apps
- Google Cloud Console: console.cloud.google.com
- Anthropic Console: console.anthropic.com
- DeepSeek Platform: platform.deepseek.com
- Resend Dashboard: resend.com/emails

---

## 15. Troubleshooting (referensi)

Kategori masalah yang harus tersedia di `/panel/dokumentasi`:

- Naskah hilang saat error/restart VPS
- Auto-post Instagram tidak muncul template di preview panel
- Status post sosmed 'Pending' terus
- AI error / timeout
- Build VPS gagal: 'pages-manifest.json not found'
- Build VPS gagal: '.next/export rename ENOENT'
- Artikel tidak muncul di Google setelah publish
- Cache lama muncul terus di website
- Instagram token expire ('Session expired')
- Editor artikel lemot di tab banyak
- User baru tidak bisa login
- Artikel auto-generated kualitas rendah
- PM2 restart error / app tidak naik
- Database connection refused
- Upload gambar gagal / 413 Request Entity Too Large
- SSL expired / site tidak bisa HTTPS
- Cloudflare cache tidak terpurge otomatis
- Email notifikasi tidak terkirim
- Google Indexing API error 403
- Bundle size besar / halaman lemot loading
- Post sosmed duplikat (2x di IG/FB)
- Komentar spam membanjiri
- Prisma error: 'Schema drift detected'
- Token Meta / IG expired
- Sitemap tidak ter-update ke Google
- Gambar artikel tidak muncul setelah publish
- Font custom tidak load di halaman publik

---

## Catatan Migrasi Lensaplus

Lensaplus saat ini punya ~60% fitur target. Yang **sudah ada** (tinggal review/polish):
- Workflow artikel DRAFT→IN_REVIEW→APPROVED→PUBLISHED + REJECTED + ARCHIVED
- 18 model DB + AuditLog + AIUsageLog + Notification
- NextAuth JWT, bcrypt 12, Zod validasi, rate-limit, sanitasi HTML
- TipTap editor (belum ada image crop + autosave 15s)
- DeepSeek AI endpoint `/api/ai/generate` (tapi bukan shared client dengan fallback)
- Basic SEO (`seoTitle`, `seoDescription` auto-fill + `onArticlePublished` ping), tapi belum ada Sorotan/FAQ/GSC Indexing API/IndexNow-terkonfirmasi
- Cron `/api/cron/publish`
- Panel: artikel, kategori, komentar, laporan, iklan, redaksi, polling, analytics, pengguna, pengaturan, dll

Yang **belum ada** / butuh dibangun:
- `src/lib/ai-client.ts` — shared caller dengan Anthropic primary + DeepSeek fallback
- Social media: 6 model DB + 15 API endpoint + `src/lib/social/*` lengkap + Sharp template renderer + panel `/panel/social`
- Sorotan: model + API generate + halaman publik `/sorotan/[slug]` + panel `/panel/sorotan`
- Auto-artikel: `TargetKeyword` model + cron + panel `/panel/auto-artikel`
- GA4 / GSC / Cloudflare Analytics wrappers di `src/lib/stats/` + panel `/panel/statistik`
- IndexNow `public/indexnow-key.txt`
- Cloudflare cache purge (`src/lib/seo-utils.ts` expansion)
- CourtSchedule model + API + halaman publik `/jadwal-sidang`
- JSON-LD lengkap (BreadcrumbList, FAQPage, HowTo, QAPage)
- Halaman `/panel/dokumentasi`
- Email notifikasi Resend (aktifkan)
- Cron: `auto-article`, `sorotan`, `seo-submit`, `backup`
- Design sistem: doc pakai hijau; Lensaplus sudah rebrand ke navy `#002045` — pertahankan rebrand
