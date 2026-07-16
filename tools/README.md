# Lensaplus — Developer Tools

CLI scripts untuk operasional + integrasi yang **bukan bagian dari runtime**.

## ⚠️ Catatan Penting Sebelum Pakai

**Default workflow Lensaplus = tulis artikel langsung di TipTap CMS** (`/panel/artikel/baru`), bukan di Obsidian. Lihat `lensaplus-editorial/WORKFLOW-SEPARATION.md` untuk panduan separasi.

| Script | Wajib? | Untuk |
|---|---|---|
| `sync-glossary.mjs` | ✅ Wajib | Satu-satunya jalur edit konten glossary publik (`/glossary`). CMS tidak punya UI editor glossary. |
| `sync-obsidian.mjs` | 🟡 Opsional (power-user) | Sync **artikel** dari Obsidian markdown → DB. Pakai HANYA kalau workflow Anda markdown-first. Default disarankan: tulis body langsung di TipTap CMS. |

## Setup

### 1. Set token di server VPS

Tambahkan ke `/var/www/lensaplus/.env`:

```bash
OBSIDIAN_SYNC_TOKEN=$(openssl rand -hex 32)
```

Restart PM2 setelahnya: `pm2 restart lensaplus`.

### 2. Set token di local (untuk jalankan script dari mesin user)

Set di terminal session (Windows PowerShell):
```powershell
$env:OBSIDIAN_SYNC_TOKEN = "paste-the-same-token-here"
```

Atau Git Bash / WSL:
```bash
export OBSIDIAN_SYNC_TOKEN='paste-the-same-token-here'
```

Token harus **sama** dengan yang di server `.env`.

## sync-obsidian.mjs (OPSIONAL — power-user)

### Kapan PAKAI script ini

- Workflow Anda murni **markdown-first** dan tetap nyaman menulis body lengkap di Obsidian sebelum pindah ke CMS
- Pernah ada pengalaman editor markdown lebih cepat dari TipTap WYSIWYG
- Mau bulk-import artikel lama dari arsip markdown

### Kapan SKIP script ini (default disarankan)

- Workflow normal: outline + research di Obsidian → buka TipTap CMS → tulis body di TipTap
- Lebih nyaman pakai AI tools toolbar TipTap (Generate Judul/Meta/Caption)
- Mau memanfaatkan autosave 15 detik TipTap ke DB
- Hindari double-source-of-truth (body di dua tempat)

### Trade-off Saat Pakai

| Pakai sync-obsidian | Tidak Pakai (default) |
|---|---|
| Body draft di Obsidian markdown editor | Body draft langsung di TipTap CMS |
| Tidak dapat AI toolbar TipTap saat menulis | Dapat AI toolbar (title/meta/caption) |
| Autosave hanya ke disk lokal | Autosave 15s ke DB Lensaplus |
| Manual `node tools/sync-obsidian.mjs --apply` setelah set status=ready | Tinggal save → submit review di TipTap |
| Setelah sync, tetap perlu finalisasi di TipTap (gambar, SEO, sosmed flag) | Semua di TipTap |
| Edit ulang artikel published → kembali ke TipTap (jangan kembali ke Obsidian) | Edit di TipTap |

### Flow

1. Buka artikel di vault Obsidian path `lensaplus-editorial/03-Artikel-Plan/{slug}.md`
2. Setelah artikel siap (outline → drafting → ready):
   - Set frontmatter `status: ready`
   - Pastikan `kategori:` sesuai dengan slug Category yang ada di DB Lensaplus (mis. `pidana`, `perdata`, `politik`)
3. Jalankan:
   ```bash
   # Dry-run dulu — lihat apa yang akan disync
   node tools/sync-obsidian.mjs

   # Apply — POST ke API + update frontmatter file
   node tools/sync-obsidian.mjs --apply
   ```

### Hasil

- API create Article status=`DRAFT` di DB Lensaplus (selalu DRAFT, editor harus review/publish via panel)
- Frontmatter file local diupdate:
  - `status: published`
  - `published-id: <article-id>`
  - `published-url: https://lensaplus.com/berita/<slug>`
- Setelah artikel di-publish via panel, frontmatter ini bisa jadi referensi balik.

### Idempotent

Kalau slug sudah ada di DB, endpoint return "already exists" + ID existing — tidak bikin duplikat. Aman dijalankan berulang.

### Konversi Markdown → HTML

Script pakai converter markdown→HTML internal (zero-dep): heading, paragraph, bold/italic, link, list, blockquote, code block, image, hr. Wikilinks `[[...]]` di-strip jadi plain text.

Untuk fitur markdown lebih lengkap (table, footnotes, dll), install `marked` di tools/ dan import. Saat ini default cukup untuk artikel berita standard.

### Custom Vault Path

```bash
node tools/sync-obsidian.mjs --apply --vault "/path/to/vault"
```

### Author Resolution

- Frontmatter `penulis: "user@email.com"` → lookup user by email di DB
- Kalau tidak ada email atau user tidak ditemukan → fallback ke "Obsidian Sync Bot" user (auto-create, role JOURNALIST, `isActive: false` jadi tidak bisa login)

### Auth & Security

- Endpoint `POST /api/external/articles/from-obsidian` butuh `Authorization: Bearer <OBSIDIAN_SYNC_TOKEN>` (timing-safe verify, min 16 char)
- Tanpa token / token salah → 401
- HTML content di-sanitize via `sanitizeHtml()` walau source dipercaya (defensive)
- Setiap sync di-log ke `AuditLog` (action: `OBSIDIAN_SYNC`)

## Environment Variables Reference

| Var | Default | Required |
|---|---|---|
| `OBSIDIAN_SYNC_TOKEN` | — | ✅ both server + client |
| `LENSAPLUS_API_URL` | `https://lensaplus.com` | optional |
| `VAULT_PATH` | `c:/Users/Owen/Documents/Aureon/lensaplus-editorial` | optional |

## Future Tools

- `sync-glossary.mjs` — sync `99-Glossary-Hukum/` → DB sebagai content publik (Phase 2 dari roadmap)
- `migrate-wordpress.mjs` — pindah artikel WordPress legacy ke Lensaplus
- `audit-broken-links.mjs` — scan artikel untuk link mati
