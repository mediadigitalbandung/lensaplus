# Kartawarta — Developer Tools

CLI scripts untuk operasional + integrasi yang **bukan bagian dari runtime**.

## Daftar Tools

| Script | Untuk |
|---|---|
| `sync-obsidian.mjs` | Sync artikel dari Obsidian editorial vault → DB Kartawarta sebagai DRAFT |

## Setup

### 1. Set token di server VPS

Tambahkan ke `/var/www/kartawarta/.env`:

```bash
OBSIDIAN_SYNC_TOKEN=$(openssl rand -hex 32)
```

Restart PM2 setelahnya: `pm2 restart kartawarta`.

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

## sync-obsidian.mjs

### Flow

1. Buka artikel di vault Obsidian path `kartawarta-editorial/03-Artikel-Plan/{slug}.md`
2. Setelah artikel siap (outline → drafting → ready):
   - Set frontmatter `status: ready`
   - Pastikan `kategori:` sesuai dengan slug Category yang ada di DB Kartawarta (mis. `pidana`, `perdata`, `politik`)
3. Jalankan:
   ```bash
   # Dry-run dulu — lihat apa yang akan disync
   node tools/sync-obsidian.mjs

   # Apply — POST ke API + update frontmatter file
   node tools/sync-obsidian.mjs --apply
   ```

### Hasil

- API create Article status=`DRAFT` di DB Kartawarta (selalu DRAFT, editor harus review/publish via panel)
- Frontmatter file local diupdate:
  - `status: published`
  - `published-id: <article-id>`
  - `published-url: https://kartawarta.com/berita/<slug>`
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
| `KARTAWARTA_API_URL` | `https://kartawarta.com` | optional |
| `VAULT_PATH` | `c:/Users/Owen/Documents/Aureon/kartawarta-editorial` | optional |

## Future Tools

- `sync-glossary.mjs` — sync `99-Glossary-Hukum/` → DB sebagai content publik (Phase 2 dari roadmap)
- `migrate-wordpress.mjs` — pindah artikel WordPress legacy ke Kartawarta
- `audit-broken-links.mjs` — scan artikel untuk link mati
