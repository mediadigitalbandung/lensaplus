# Kartawarta — Audit Plan (18 Dimensi)

> Master plan untuk audit menyeluruh Kartawarta v2.0 post-migration. Dibaca & ditulis ulang oleh `audit-lead` agent tiap sesi audit.
>
> Status simbol: `[ ]` todo · `[~]` in_progress · `[x]` done · `[!]` blocked

## Tujuan
Verifikasi 18 dimensi kualitas project sebelum/sesudah rilis besar, dengan severity matrix konsisten lintas dimensi (🔴 Critical / 🟠 High / 🟡 Medium / ⚪ Low / ℹ️ Info).

Hasil audit di `docs/AUDIT_REPORT.md` (overwrite per session) dengan history per session di `docs/AUDIT_HISTORY/` (kalau perlu).

## 18 Dimensi (5 Layer)

### Layer 1 — Code & Build
| # | Dimensi | Sub-Auditor | Status |
|---|---|---|---|
| 1 | Security (OWASP, secret, XSS/SQLi/SSRF/IDOR) | `security-auditor` | `[ ]` |
| 2 | Auth & RBAC coverage | `auth-guardian` (audit mode) | `[ ]` |
| 3 | Build & TypeScript | `build-test-validator` | `[ ]` |
| 4 | Test coverage gap | `build-test-validator` (extended) | `[ ]` |

### Layer 2 — Data & Persistence
| # | Dimensi | Sub-Auditor | Status |
|---|---|---|---|
| 5 | Database schema, index, query patterns | `db-auditor` | `[ ]` |
| 6 | Backup & DR | `backup-dr-auditor` | `[ ]` |
| 7 | Privacy & data retention (UU PDP) | `privacy-compliance-auditor` | `[ ]` |

### Layer 3 — Performance & SEO
| # | Dimensi | Sub-Auditor | Status |
|---|---|---|---|
| 8 | Performance (bundle, ISR, image, N+1) | `perf-auditor` | `[ ]` |
| 9 | SEO infra (JSON-LD, sitemap, canonical) | `seo-auditor` | `[ ]` |
| 10 | Accessibility (WCAG 2.1 AA) | `a11y-auditor` | `[ ]` |

### Layer 4 — Integrations & Operations
| # | Dimensi | Sub-Auditor | Status |
|---|---|---|---|
| 11 | API design consistency | `api-design-auditor` | `[ ]` |
| 12 | Cron & background jobs | `observability-auditor` (extended) | `[ ]` |
| 13 | External integrations health | `integration-health-auditor` | `[ ]` |
| 14 | Observability (Sentry, AuditLog, logs) | `observability-auditor` | `[ ]` |

### Layer 5 — Product & Editorial
| # | Dimensi | Sub-Auditor | Status |
|---|---|---|---|
| 15 | Design system consistency | `design-guardian` | `[ ]` |
| 16 | Content safety (sanitize, moderation) | `content-safety-auditor` | `[ ]` |
| 17 | Editorial workflow & state machine | `content-safety-auditor` (extended) | `[ ]` |
| 18 | Dependencies & supply chain | `dep-auditor` | `[ ]` |

## Eksekusi (4 Wave Paralel)

### Wave 1 — Independent baseline (paralel 5)
- `security-auditor`
- `auth-guardian` (audit mode — RBAC coverage)
- `build-test-validator`
- `design-guardian`
- `dep-auditor`

### Wave 2 — Code-pattern audits (paralel 5)
- `db-auditor`
- `perf-auditor`
- `seo-auditor`
- `a11y-auditor`
- `api-design-auditor`

### Wave 3 — Operational audits (paralel 4)
- `observability-auditor` (covers cron #12 + obs #14)
- `integration-health-auditor`
- `content-safety-auditor` (covers content #16 + workflow #17)
- `backup-dr-auditor`

### Wave 4 — Privacy (paralel 1, akhir karena butuh cross-reference dari wave lain)
- `privacy-compliance-auditor`

## Severity Convention
- 🔴 **CRITICAL** — exploit aktif / data loss / production down → BLOCK release
- 🟠 **HIGH** — high probability harm → fix sebelum next release
- 🟡 **MEDIUM** — fix dalam 1-2 sprint
- ⚪ **LOW** — best practice, fix kalau sempat
- ℹ️ **INFO** — observasi, bukan temuan

## Out of Scope
- ❌ Penetration testing live (read-only audit)
- ❌ Lighthouse / WebPageTest live (heuristik dari source)
- ❌ Legal advice (privacy auditor flag, bukan vouch)
- ❌ Auto-fix temuan (delegasi ke `tech-lead`/`release-lead` post-audit)

## Mode Audit
- **`full`** (default) — semua 18 dimensi
- **`delta`** — hanya dimensi yang touched diff sejak audit terakhir
- **`dimension:NAME`** — verifikasi pasca-fix dimensi tertentu

## Session Log

> Append di sini per session audit.

### 2026-05-07 → 2026-05-08 — Audit Menyeluruh #1 (post-migration baseline) ✅
- Mode: `full`
- Trigger: User minta "audit menyeluruh, kepala audit" setelah 13/13 fase migrasi selesai
- Status: **SELESAI**
- Hasil: 16 CRITICAL + 44 HIGH + 52 MEDIUM + 31 LOW + 8 INFO = 151 findings
- Verdict final: ❌ **BLOCK RELEASE** — perlu Sprint 0 dulu (CRIT-01 stored XSS regression, CRIT-13/14 backup gap, CRIT-11/12 integration silent-fail, CRIT-05/06/07/08 a11y, CRIT-15/16 design legacy)
- Report lengkap: [docs/AUDIT_REPORT.md](AUDIT_REPORT.md)
- Sub-auditor invoked: 14 (Wave 1: security/auth-guardian/build-test/design-guardian/dep-auditor; Wave 2: db/perf/seo/a11y/api-design; Wave 3: observability/integration-health/content-safety/backup-dr/privacy)
- 12 agent baru ditambahkan ke `.claude/agents/`: audit-lead, perf-auditor, seo-auditor, db-auditor, a11y-auditor, dep-auditor, api-design-auditor, observability-auditor, integration-health-auditor, content-safety-auditor, backup-dr-auditor, privacy-compliance-auditor

## Update Status Dimensi (post-audit)

| # | Dimensi | Audit-1 status |
|---|---|---|
| 1 | Security | ⚠️ FIX REKOM (3 HIGH) |
| 2 | Auth & RBAC | ⚠️ FIX REKOM (3 HIGH) |
| 3 | Build & Types | ✅ OK |
| 4 | Test coverage | ⚠️ GAP (4 lib folder 0%) |
| 5 | Database | ⚠️ FIX REKOM (2 HIGH) |
| 6 | Backup & DR | ❌ BLOCK (2 CRIT) |
| 7 | Privacy | ⚠️ FIX REKOM (4 HIGH) |
| 8 | Performance | ❌ BLOCK (2 CRIT) |
| 9 | SEO | ⚠️ FIX REKOM (2 HIGH) |
| 10 | Accessibility | ❌ BLOCK (4 CRIT) |
| 11 | API design | ❌ BLOCK (2 CRIT) |
| 12 | Cron jobs | ⚠️ FIX REKOM (2 HIGH TOCTOU) |
| 13 | Integrations | ❌ BLOCK (2 CRIT) |
| 14 | Observability | ⚠️ FIX REKOM (3 HIGH) |
| 15 | Design system | ❌ BLOCK (3 CRIT legacy) |
| 16 | Content safety | ❌ BLOCK (1 CRIT XSS regression) |
| 17 | Editorial workflow | ✅ OK (state machine fully role-enforced) |
| 18 | Dependencies | ⚠️ FIX REKOM (5 HIGH CVE) |
