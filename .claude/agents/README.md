# Kartawarta Agent System

Struktur agent khusus untuk Kartawarta v2.0. Setiap agent punya **1 tanggung jawab tunggal** — tidak overlap.

## Cara Invoke

Saat user minta sesuatu ke Claude Code:
- **Permintaan editorial kompleks** (buat artikel end-to-end) → panggil `editorial-lead`
- **Permintaan coding multi-layer** (fitur baru, refactor) → panggil `tech-lead`
- **Mau rilis ke production** → panggil `release-lead`
- **Eksekusi migrasi fitur** (samakan dengan `docs/FEATURE_REFERENCE.md`) → panggil `migration-lead`
- **Audit menyeluruh project** (security + perf + SEO + a11y + DB + …) → panggil `audit-lead`
- **Audit responsiveness di semua device** (320px hingga 4K) → panggil `responsive-lead`
- **Tugas tunggal** — panggil specialist langsung (mis. `copy-editor` untuk proofread saja)

Agent dipanggil otomatis oleh Claude berdasarkan `description` di frontmatter, atau manual dengan:
```
> gunakan fact-checker untuk verifikasi artikel ini
```

## Struktur (48 Agent: 18 Core + 10 Migration + 12 Audit + 8 Responsive)

### 🗞️ Domain Editorial — Produksi Konten
| Agent | Fokus Tunggal |
|---|---|
| **editorial-lead** | Orchestrator alur artikel end-to-end |
| article-drafter | Tulis draft awal (5W+1H jurnalistik) |
| fact-checker | Verifikasi klaim/sumber/kutipan |
| copy-editor | EYD/PUEBI, gaya bahasa |
| seo-specialist | Judul, meta, slug, keyword |
| taxonomy-curator | Kategori & tag dari DB |

### 💻 Domain Development — Kode
| Agent | Fokus Tunggal |
|---|---|
| **tech-lead** | Orchestrator perubahan kode multi-layer |
| frontend-dev | React/Next pages + Tailwind |
| api-dev | API routes di `src/app/api/` |
| database-architect | Prisma schema + migration |
| auth-guardian | NextAuth + role permission |

### 🚀 Domain Release & Ops — Quality + Deploy + Moderasi
| Agent | Fokus Tunggal |
|---|---|
| **release-lead** | Orchestrator pipeline release |
| design-guardian | Enforce design system CLAUDE.md |
| build-test-validator | next build + lint + vitest |
| security-auditor | OWASP + secret scan |
| git-release-specialist | commit + push + curl verify |
| comment-moderator | Approve/reject komentar user |
| report-handler | Triage laporan hoax/SARA |

### 🔍 Domain Audit — Audit Menyeluruh Project (18 Dimensi)
| Agent | Fokus Tunggal |
|---|---|
| **audit-lead** | Orchestrator: koordinasi 14 sub-auditor, sintesa `docs/AUDIT_REPORT.md` dengan severity matrix |
| perf-auditor | Performance: bundle, ISR/dynamic mapping, image, N+1, Core Web Vitals risk |
| seo-auditor | SEO infra: JSON-LD, sitemap, canonical, indexing pipeline |
| db-auditor | Schema drift, index coverage, dead column, FK cascade, raw SQL safety |
| a11y-auditor | WCAG 2.1 AA: semantic HTML, ARIA, kontras, keyboard nav, alt text |
| dep-auditor | npm audit (CVE), outdated, license, unused deps, lockfile integrity |
| api-design-auditor | REST consistency: status code, error shape, pagination, idempotency |
| observability-auditor | Sentry, AuditLog completeness, cron secret/idempotency, error boundary |
| integration-health-auditor | Anthropic/DeepSeek fallback, Meta token, Google APIs, Cloudflare, Resend |
| content-safety-auditor | Sanitize coverage, state machine artikel, comment moderation, autosave |
| backup-dr-auditor | DB backup script, retention, off-site, restore docs, RTO/RPO |
| privacy-compliance-auditor | UU PDP, cookie consent, retention, DSR, cross-border transfer |
| (existing) security-auditor | Layer 1 #1 — OWASP, secret, XSS, SQLi, SSRF, IDOR |
| (existing) auth-guardian | Layer 1 #2 audit-mode — RBAC coverage di /panel/* & /api/* |
| (existing) build-test-validator | Layer 1 #3-4 — typecheck/lint/build/vitest |
| (existing) design-guardian | Layer 5 #15 — token consistency, legacy `goto.green` purge |

### 📐 Domain Responsive — Audit + Fix Layout di Semua Device (320px–4K)
| Agent | Fokus Tunggal |
|---|---|
| **responsive-lead** | Orchestrator: paralel-spawn 6 viewport sub-agent, konsolidasi finding per file, delegasi fix-applier |
| viewport-mobile-small | 320–380px (iPhone SE 1st gen, Galaxy Fold folded) |
| viewport-mobile-large | 381–640px (iPhone 12/13/14, Pixel, Galaxy S22) — mayoritas traffic |
| viewport-tablet-portrait | 641–768px (iPad mini portrait, Surface Duo) — transisi `sm:`/`md:` |
| viewport-tablet-landscape | 769–1024px (iPad landscape, Surface Pro) — transisi `md:`/`lg:` |
| viewport-desktop | 1025–1440px (MacBook 13"–16", monitor 1080p/1440p) |
| viewport-widescreen | 1441px+ (iMac 24"/27", ultrawide, 4K) |
| responsive-fix-applier | Konsolidasi finding multi-tier per file → Edit class Tailwind responsif |

### 🚧 Domain Feature Migration — Samakan Kartawarta dengan `docs/FEATURE_REFERENCE.md`
| Agent | Fokus Tunggal |
|---|---|
| **migration-lead** | Orchestrator: baca `docs/MIGRATION_PROGRESS.md`, pick task, delegasi, update progress |
| ai-client-builder | `src/lib/ai-client.ts` — Claude primary + DeepSeek fallback + AIUsageLog |
| seo-distributor | Google Indexing API + IndexNow + Sorotan generator + JSON-LD + news sitemap |
| social-publisher | Meta Graph API IG + FB publisher + orchestrator + caption AI |
| social-template-renderer | Sharp-based template image rendering (composite + text layers) |
| analytics-connector | GA4 + GSC + Cloudflare Analytics + Internal stats → API `/api/stats/*` |
| cloudflare-ops | Cache purge otomatis saat publish (via `purgeCache()`) |
| cron-engineer | Cron endpoint `/api/cron/*` + crontab docs |
| integration-secrets-ui | Refactor `/panel/pengaturan` per integrasi + test buttons |
| doc-panel-builder | `/panel/dokumentasi` render `FEATURE_REFERENCE.md` (SUPER_ADMIN) |

## Alur Kerja Umum

### A. Buat Artikel Baru End-to-End
```
User: "Buatkan artikel tentang putusan MA kasus X"
         ↓
editorial-lead
         ↓
article-drafter → fact-checker → copy-editor
         ↓                           ↓
   (paralel) seo-specialist + taxonomy-curator
         ↓
editorial-lead sintesa → siap paste ke panel admin
```

### B. Tambah Fitur Baru (Kode)
```
User: "Tambah fitur bookmark folder di panel"
         ↓
tech-lead
         ↓
database-architect (schema) → api-dev (endpoint) → frontend-dev (UI)
         ↓                                             ↓
       auth-guardian (role check)           design-guardian (audit)
         ↓
release-lead
         ↓
build-test-validator → security-auditor → git-release-specialist
         ↓
✅ Production verified
```

### C. Release Setiap Perubahan (Wajib per CLAUDE.md)
```
User: "Sudah siap, deploy ya"
         ↓
release-lead
         ↓
build-test-validator (build pass?)
         ↓ ya
design-guardian (design OK?)
         ↓ ya
security-auditor (no vuln?)
         ↓ ya
git-release-specialist (commit + push + curl)
         ↓
Report: commit hash + URL 200
```

### D. Moderasi Rutin (Harian)
```
User: "Cek komentar pending dan laporan"
         ↓ (paralel)
comment-moderator          report-handler
(approve/reject)           (triage → action plan)
```

### E. Migrasi Fitur (Lanjut tanpa user menyuruh)
```
User: "Lanjutkan migrasi fitur" (atau "lanjut")
         ↓
migration-lead
         ↓ baca docs/MIGRATION_PROGRESS.md, pick task [ ] berikutnya
         ↓ pilih specialist sesuai matriks
         ↓ delegasi & validasi hasil
         ↓ update [x] di progress file + log sesi
         ↓ pick task berikutnya, lanjut
         ↓
Loop sampai fase selesai → build-test-validator → release-lead → user dipanggil hanya kalau:
  - butuh API key user (Anthropic, Meta, dll)
  - blocker yang butuh keputusan (breaking schema, design choice)
  - fase selesai dan siap commit
```

### G. Audit Responsiveness Semua Device
```
User: "Audit responsiveness di semua device" / "perbaiki tampilan di hp/tablet/layar besar"
         ↓
responsive-lead
         ↓ (paralel SATU pesan, 6 sub-agent)
viewport-mobile-small (320-380)   ┐
viewport-mobile-large (381-640)   │
viewport-tablet-portrait (641-768)├─→ konsolidasi per file (P0/P1/P2/P3)
viewport-tablet-landscape (769-1024)│
viewport-desktop (1025-1440)      │
viewport-widescreen (1441+)       ┘
         ↓
responsive-fix-applier (Edit class Tailwind per file, semua tier issue sekaligus)
         ↓
build-test-validator → git-release-specialist
```

### F. Audit Menyeluruh (18 Dimensi)
```
User: "Audit project ini" / "audit menyeluruh" / "kepala audit"
         ↓
audit-lead
         ↓ Wave 1 (paralel 5): security + auth-guardian + build-test + design + dep
         ↓ Wave 2 (paralel 5): db + perf + seo + a11y + api-design
         ↓ Wave 3 (paralel 4): observability + integration-health + content-safety + backup-dr
         ↓ Wave 4 (paralel 1): privacy
         ↓ konsolidasi: docs/AUDIT_REPORT.md (severity matrix + remediation roadmap)
         ↓
Report final ke user → kalau ada CRITICAL/HIGH → delegasi tech-lead untuk fix
```

## Prinsip Desain

1. **Single Responsibility** — setiap agent 1 fokus. Fact-checker tidak menulis ulang. Copy-editor tidak cek fakta.
2. **No Double Job** — kalau dua agent bisa lakukan hal yang sama, salah satunya salah scope — refine.
3. **Delegation Chain** — orchestrator tidak mengerjakan detail. Specialist tidak orchestrate.
4. **Explicit Scope & Out-of-Scope** — tiap agent punya section "JANGAN lakukan" dengan delegasi ke siapa.
5. **Output Format Standar** — biar orchestrator bisa sintesa dengan mudah.

## File Structure

```
.claude/agents/
├── README.md                      (file ini)
│
├── editorial-lead.md              orchestrator
├── article-drafter.md
├── fact-checker.md
├── copy-editor.md
├── seo-specialist.md
├── taxonomy-curator.md
│
├── tech-lead.md                   orchestrator
├── frontend-dev.md
├── api-dev.md
├── database-architect.md
├── auth-guardian.md
│
├── release-lead.md                orchestrator
├── design-guardian.md
├── build-test-validator.md
├── security-auditor.md
├── git-release-specialist.md
│
├── comment-moderator.md
├── report-handler.md
│
├── migration-lead.md                 orchestrator (feature parity to docs/FEATURE_REFERENCE.md)
├── ai-client-builder.md
├── seo-distributor.md
├── social-publisher.md
├── social-template-renderer.md
├── analytics-connector.md
├── cloudflare-ops.md
├── cron-engineer.md
├── integration-secrets-ui.md
├── doc-panel-builder.md
│
├── responsive-lead.md                orchestrator (audit responsiveness 6 viewport tier)
├── viewport-mobile-small.md
├── viewport-mobile-large.md
├── viewport-tablet-portrait.md
├── viewport-tablet-landscape.md
├── viewport-desktop.md
├── viewport-widescreen.md
├── responsive-fix-applier.md
│
├── audit-lead.md                     orchestrator (18-dimension audit menyeluruh)
├── perf-auditor.md
├── seo-auditor.md
├── db-auditor.md
├── a11y-auditor.md
├── dep-auditor.md
├── api-design-auditor.md
├── observability-auditor.md
├── integration-health-auditor.md
├── content-safety-auditor.md
├── backup-dr-auditor.md
└── privacy-compliance-auditor.md
```

## Maintenance

- **Menambah agent baru** — pastikan fokusnya tidak overlap dengan yang ada. Update README ini.
- **Mengubah scope** — perbaiki juga tabel "Out of Scope" di agent lain yang menyebut tanggung jawab tersebut.
- **Deprecate agent** — hapus file + hapus referensi di orchestrator.
